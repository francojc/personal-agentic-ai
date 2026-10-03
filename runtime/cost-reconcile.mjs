// Correlate metadata-only PAOS run events with Bifrost logs. Never guess when match is ambiguous.
const MODEL = "minimax-m2.7";
const PROVIDER = "zen";
const VK = "paos-worker";

function eventTime(event) {
  const n = Date.parse(event?.time);
  return Number.isFinite(n) ? n : null;
}

export function reconcileRun(events, bifrostLogs, { windowMs = 15 * 60 * 1000 } = {}) {
  const started = events.find((e) => e.type === "started");
  const terminal = [...events].reverse().find((e) => ["completed", "failed", "interrupted"].includes(e.type));
  const pi = [...events].reverse().find((e) => e.type === "completed" || e.type === "failed");
  const startMs = eventTime(started);
  if (startMs === null) return { status: "unmatched", reason: "missing start timestamp", human_acceptance: "not reviewed" };
  const endMs = terminal ? eventTime(terminal) : startMs + windowMs;
  const candidates = bifrostLogs.filter((log) => {
    const time = eventTime({ time: log.timestamp });
    return log.virtual_key_name === VK && log.provider === PROVIDER &&
      (log.model === MODEL || log.model === `zen/${MODEL}`) &&
      time !== null && time >= startMs && time <= (endMs ?? startMs + windowMs);
  });
  if (!candidates.length) return {
    status: "missing", candidate_count: 0,
    pi_estimated_cost_usd: pi?.cost_usd ?? null,
    bifrost_reported_cost_usd: null, cost_delta_usd: null,
    human_acceptance: "not reviewed",
  };
  // Multiple distinct gateway requests are expected per run. Identical timestamps without
  // request IDs cannot be disambiguated safely and are reported rather than double-counted.
  const requestIds = candidates.map((log) => log.request_id ?? log.id ?? null);
  if (candidates.length > 1 && candidates.some((log, i) => candidates.some((other, j) => i !== j && log.timestamp === other.timestamp)) && requestIds.some((id) => !id)) return {
    status: "ambiguous", candidate_count: candidates.length,
    pi_estimated_cost_usd: pi?.cost_usd ?? null,
    bifrost_reported_cost_usd: null, cost_delta_usd: null,
    human_acceptance: "not reviewed",
  };
  const usages = candidates.map((log) => log.token_usage ?? log.usage);
  if (usages.some((usage) => !usage || typeof usage !== "object")) return {
    status: "missing_usage", candidate_count: candidates.length,
    pi_estimated_cost_usd: pi?.cost_usd ?? null,
    bifrost_reported_cost_usd: null, cost_delta_usd: null,
    human_acceptance: "not reviewed",
  };
  const costs = candidates.map((log) => Number(log.cost));
  if (costs.some((cost) => !Number.isFinite(cost) || cost < 0)) return {
    status: "missing_cost", candidate_count: candidates.length,
    pi_estimated_cost_usd: pi?.cost_usd ?? null,
    bifrost_reported_cost_usd: null, cost_delta_usd: null,
    human_acceptance: "not reviewed",
  };
  const cost = costs.reduce((sum, value) => sum + value, 0);
  const estimated = Number(pi?.cost_usd);
  return {
    status: "matched", candidate_count: candidates.length,
    pi_estimated_cost_usd: Number.isFinite(estimated) ? estimated : null,
    bifrost_reported_cost_usd: cost,
    cost_delta_usd: Number.isFinite(estimated) ? cost - estimated : null,
    token_usage: usages,
    bifrost_timestamps: candidates.map((log) => log.timestamp),
    human_acceptance: "not reviewed",
  };
}
