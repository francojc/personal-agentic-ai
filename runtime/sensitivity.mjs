// Resolves the TRUSTED sensitivity of the current task (runs in the launcher, outside the sandbox).
// Source of truth: human-applied Multica issue labels, read with the daemon's task-scoped token.
// The issue id comes from the daemon-written marker, never from the prompt. Anything unresolved,
// ambiguous or erroring is non-public => policy HOLD ("error" is tolerated briefly mid-run by the gate). Labels only tighten (see policy.classifyLabels).
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { classifyLabels } from "./policy.mjs";

export const MARKER = ".multica/daemon_task_context.json";

export function readMarker(cwd, env) {
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(cwd, MARKER), "utf8")); } catch { return { ok: false, reason: "task marker missing or unreadable" }; }
  if (m.managed_by !== "multica-daemon-task") return { ok: false, reason: "marker not daemon-managed" };
  if (!m.issue_id) return { ok: false, reason: "no issue bound to task (chat/autopilot runs are not public-labelled)" };
  if (m.agent_id && env.MULTICA_AGENT_ID && m.agent_id !== env.MULTICA_AGENT_ID) return { ok: false, reason: "marker agent mismatch" };
  return { ok: true, issueId: String(m.issue_id) };
}

/** Accepts `[{name:"public"}, ...]`, `{labels:[...]}` or ["public"]. Returns lowercase names or null if unrecognised. */
export function extractLabelNames(json) {
  const arr = Array.isArray(json) ? json : Array.isArray(json?.labels) ? json.labels : null;
  if (!arr) return null;
  const names = arr.map((x) => (typeof x === "string" ? x : x?.name ?? x?.label?.name)).filter((n) => typeof n === "string");
  return names.length === arr.length ? names : null;
}

const defaultRun = (bin, args, env) => new Promise((resolve, reject) =>
  execFile(bin, args, { env, timeout: 15_000, maxBuffer: 1 << 20 }, (err, stdout) => (err ? reject(err) : resolve(stdout))));

export async function resolveSensitivity({ env, cfg, cwd = process.cwd(), run = defaultRun }) {
  const mk = readMarker(cwd, env);
  if (!mk.ok) return "unknown";
  const bin = cfg?.paths?.multica || "/opt/paos/bin/multica";
  const childEnv = { PATH: "/usr/bin:/bin", HOME: cfg?.paths?.state ? path.join(cfg.paths.state, "home") : "/tmp",
    MULTICA_TOKEN: env.MULTICA_TOKEN, MULTICA_SERVER_URL: env.MULTICA_SERVER_URL, MULTICA_WORKSPACE_ID: env.MULTICA_WORKSPACE_ID,
    MULTICA_AGENT_ID: env.MULTICA_AGENT_ID, MULTICA_TASK_ID: env.MULTICA_TASK_ID };
  let out;
  // "error" = could not verify (transient); "unknown" = verified but no explicit public label. Both are non-public.
  try { out = await run(bin, ["issue", "label", "list", mk.issueId, "--output", "json"], childEnv); } catch { return "error"; }
  let parsed; try { parsed = JSON.parse(out); } catch { return "error"; }
  const names = extractLabelNames(parsed);
  return names ? classifyLabels(names) : "error";
}
