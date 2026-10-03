// PAOS policy: pure, dependency-free functions. Enforced by the trusted wrapper and the Pi
// extension – never by prompts. Contract: docs/RUNTIME-CONTRACT.md, docs/GATEWAY-CONTRACT.md.
import net from "node:net";

export const TOOL_ALLOWLIST = Object.freeze(["web_search", "web_fetch", "write_report", "read", "grep", "find", "ls"]);

/** Arguments Multica's native Pi backend passes. Anything else is rejected, not forwarded. */
export function parseMulticaArgs(argv) {
  const out = { session: null, ignored: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p") continue;
    if (a === "--mode") { if (argv[++i] !== "json") throw new Error("only --mode json is supported"); continue; }
    if (a === "--session") { out.session = argv[++i]; if (!out.session) throw new Error("--session needs a path"); continue; }
    if (a === "--model" || a === "--thinking") { out.ignored.push(a, argv[++i]); continue; } // model is fixed by PAOS
    throw new Error(`unsupported argument: ${a}`);
  }
  if (!out.session) throw new Error("--session is required");
  return out;
}

const REQUIRED_ENV = ["MULTICA_TASK_ID", "MULTICA_AGENT_ID", "MULTICA_WORKSPACE_ID"];

/** Decide whether a run may start. Sensitivity must be explicitly `public`; unknown holds. */
export function evaluateLaunch({ env, config, sensitivity }) {
  for (const k of REQUIRED_ENV) if (!env[k]) return hold(`missing trusted metadata ${k}`);
  if (!config.allowedAgentIds?.includes(env.MULTICA_AGENT_ID)) return hold("agent is not allow-listed for PAOS");
  if (config.allowedWorkspaceIds?.length && !config.allowedWorkspaceIds.includes(env.MULTICA_WORKSPACE_ID)) return hold("workspace is not allow-listed");
  if (sensitivity !== "public") return hold(`sensitivity '${sensitivity ?? "unknown"}' is not public; v0.1 runs public tasks only`);
  return { allow: true };
}
const hold = (reason) => ({ allow: false, reason });

/** Normalize a human label set to a single sensitivity. Any non-public marker wins (labels only tighten). */
export function classifyLabels(labels = []) {
  const l = new Set(labels.map((x) => String(x).trim().toLowerCase()));
  if (l.has("private") || l.has("sensitive")) return "private";
  if (l.has("public") && l.size >= 1) return "public";
  return "unknown";
}

// ---- network guard -------------------------------------------------------------------------
const V4_BLOCKS = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const v4int = (ip) => ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
export function isPrivateIp(ip) {
  const fam = net.isIP(ip);
  if (fam === 4) return V4_BLOCKS.some(([b, bits]) => ((v4int(ip) ^ v4int(b)) >>> (32 - bits)) === 0 || bits === 0);
  if (fam === 6) {
    const x = ip.toLowerCase();
    const m = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (m) return isPrivateIp(m[1]);
    return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") ||
      x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff") || x.startsWith("2001:db8");
  }
  return true; // not an IP: caller must resolve first
}

/** Static URL check (no DNS). DNS answers are re-checked at connect time by the fetch tool. */
export function checkUrlStatic(raw) {
  let u;
  try { u = new URL(raw); } catch { return { ok: false, reason: "invalid URL" }; }
  if (!["http:", "https:"].includes(u.protocol)) return { ok: false, reason: "only http/https" };
  if (u.username || u.password) return { ok: false, reason: "credentials in URL" };
  if (u.port && !["80", "443"].includes(u.port)) return { ok: false, reason: "non-standard port" };
  const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".ts.net")) return { ok: false, reason: "internal hostname" };
  if (net.isIP(h) && isPrivateIp(h)) return { ok: false, reason: "private address" };
  if (!h.includes(".") && !net.isIP(h)) return { ok: false, reason: "single-label hostname" };
  return { ok: true, url: u };
}

// ---- budget and counters -------------------------------------------------------------------
export function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); } // UTC calendar month

/** Per-run spend guard. Cost comes from Pi usage events; worst-case single request is bounded by
 *  model maxTokens/contextWindow in models.json, so killAt = limit - worstCaseRequest. */
export class RunBudget {
  constructor({ perRunUsd, worstCaseRequestUsd }) { this.limit = perRunUsd; this.margin = worstCaseRequestUsd; this.spent = 0; this.unknown = 0; }
  add(costUsd) { if (typeof costUsd === "number" && Number.isFinite(costUsd)) this.spent += costUsd; else this.unknown++; return this.status(); }
  status() {
    if (this.unknown > 0) return { ok: false, reason: "unknown cost reported" }; // fail closed
    if (this.spent + this.margin > this.limit) return { ok: false, reason: `run budget: $${this.spent.toFixed(4)} + margin exceeds $${this.limit.toFixed(2)}` };
    return { ok: true };
  }
}

export function monthlyAllowance({ ledgerLines, monthlyUsd, perRunUsd, now = new Date() }) {
  const key = monthKey(now); let spent = 0;
  for (const line of ledgerLines) {
    try { const r = JSON.parse(line); if (r.month === key) spent += Number(r.cost_usd_reserved ?? r.cost_usd ?? 0); } catch { spent += perRunUsd; /* corrupt line: assume worst */ }
  }
  return { ok: spent + perRunUsd <= monthlyUsd, spent, remaining: Math.max(0, monthlyUsd - spent) };
}

export class ToolCounter {
  constructor(max) { this.max = max; this.n = 0; }
  next() { this.n++; return this.n <= this.max; }
}
