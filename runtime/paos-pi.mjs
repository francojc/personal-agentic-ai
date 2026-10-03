#!/usr/bin/env node
// Trusted PAOS launcher. Multica's native Pi backend runs this in place of `pi` (MULTICA_PI_PATH).
// It validates the run, builds a bubblewrap sandbox with a cleared environment, forwards Pi's JSONL
// to Multica unchanged, and enforces deadline/tool/budget limits from OUTSIDE the sandbox.
// Exit codes: 0 ok | 2 bad invocation | 3 HELD by policy | 4 limit/cancel | 5 run failed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { parseMulticaArgs, evaluateLaunch, monthlyAllowance, monthKey } from "./policy.mjs";
import { StreamMonitor } from "./monitor.mjs";
import { resolveSensitivity } from "./sensitivity.mjs";
import { acquireLock } from "./lock.mjs";

const CONFIG_PATH = process.env.PAOS_WORKER_CONFIG || "/etc/paos/worker.json";
const fail = (code, msg) => { process.stderr.write(`PAOS: ${msg}\n`); process.exit(code); };

export function buildBwrapArgs({ cfg, cwd, sessionFile, agentDir, gatewayKey, tz }) {
  const p = cfg.paths;
  const ro = (s, d = s) => (fs.existsSync(s) ? ["--ro-bind", s, d] : []);
  const piCli = path.join(p.pi, "lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
  return [
    "--unshare-user", "--unshare-pid", "--unshare-ipc", "--unshare-uts", "--unshare-cgroup-try", "--die-with-parent", "--new-session", "--clearenv",
    "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64", "--symlink", "usr/sbin", "/sbin",
    ...ro(p.node), ...ro(p.pi), ...ro(p.runtime),
    ...ro("/etc/resolv.conf"), ...ro("/etc/hosts"), ...ro("/etc/nsswitch.conf"), ...ro("/etc/ssl"), ...ro("/etc/ca-certificates"),
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
    "--bind", cwd, "/work", "--chdir", "/work",
    "--ro-bind", agentDir, "/agent", "--bind", sessionFile, "/session.jsonl",
    "--setenv", "PATH", "/usr/bin:/bin", "--setenv", "HOME", "/tmp", "--setenv", "TZ", tz || "UTC",
    "--setenv", "PI_CODING_AGENT_DIR", "/agent", "--setenv", "PAOS_GATEWAY_KEY", gatewayKey, "--setenv", "NODE_OPTIONS", "--max-old-space-size=768",
    "--",
    path.join(p.node, "bin/node"), piCli,
    "-p", "--mode", "json", "--session", "/session.jsonl",
    "--provider", cfg.model.provider, "--model", cfg.model.id,
    "--tools", "web_search,web_fetch,write_report", "-e", path.join(p.runtime, "extensions/paos-research.mjs"),
    "--no-skills", "--no-prompt-templates", "--no-themes", "--offline",
    "--append-system-prompt", cfg.systemPrompt,
  ];
}

export function modelsJson(cfg) {
  return { providers: { [cfg.model.provider]: { baseUrl: cfg.gatewayBaseUrl, api: "openai-completions", apiKey: "$PAOS_GATEWAY_KEY",
    models: [{ id: cfg.model.id, name: "PAOS research", reasoning: false, input: ["text"], contextWindow: cfg.model.contextWindow, maxTokens: cfg.model.maxTokens, cost: cfg.model.cost }] } } };
}

async function main() {
  if (process.argv[2] === "--version" || process.argv[2] === "-v") { process.stdout.write("1.0.1\n"); process.exit(0); } // daemon probe
  let args, cfg;
  try { args = parseMulticaArgs(process.argv.slice(2)); } catch (e) { fail(2, `bad invocation: ${e.message}`); }
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch (e) { fail(2, `cannot read config: ${e.message}`); }

  const runId = crypto.randomUUID(); const t0 = Date.now(); const month = monthKey();
  const logPath = path.join(cfg.paths.state, "runs", `${month}.jsonl`); fs.mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
  let seq = 0;
  const log = (type, payload = {}) => fs.appendFileSync(logPath, JSON.stringify({ schema_version: 1, run_id: runId, seq: ++seq, time: new Date().toISOString(), type, ...payload }) + "\n");
  const ledgerPath = path.join(cfg.paths.state, "ledger.jsonl");
  const ledger = (o) => fs.appendFileSync(ledgerPath, JSON.stringify({ month, run_id: runId, ...o }) + "\n");
  const hold = (reason) => { log("held", { reason }); ledger({ status: "held", cost_usd: 0 }); fail(3, `HOLD: ${reason}`); };

  const sensitivity = await resolveSensitivity({ env: process.env, cfg }).catch(() => "unknown");
  const verdict = evaluateLaunch({ env: process.env, config: cfg, sensitivity });
  log("policy_decision", { allow: verdict.allow, sensitivity, task: process.env.MULTICA_TASK_ID, agent: process.env.MULTICA_AGENT_ID, policy_version: cfg.policyVersion });
  if (!verdict.allow) hold(verdict.reason);

  const ledgerLines = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean) : [];
  const allow = monthlyAllowance({ ledgerLines, monthlyUsd: cfg.limits.monthlyUsd, perRunUsd: cfg.limits.perRunUsd });
  if (!allow.ok) hold(`monthly budget exhausted (spent $${allow.spent.toFixed(2)} of $${cfg.limits.monthlyUsd})`);

  const lock = acquireLock(path.join(cfg.paths.state, "run.lock"));
  if (!lock.ok) hold(`another PAOS run is active or lock unavailable (${lock.reason})`);
  let agentDir = null;
  process.on("exit", () => { lock.release(); if (agentDir) fs.rmSync(agentDir, { recursive: true, force: true }); }); // also covers internal errors

  agentDir = fs.mkdtempSync(path.join(cfg.paths.state, "agent-"));
  fs.writeFileSync(path.join(agentDir, "models.json"), JSON.stringify(modelsJson(cfg)));
  fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "never", defaultProvider: cfg.model.provider, defaultModel: cfg.model.id }));
  const gatewayKey = fs.readFileSync(cfg.paths.gatewayKeyFile, "utf8").trim();
  const bw = buildBwrapArgs({ cfg, cwd: process.cwd(), sessionFile: args.session, agentDir, gatewayKey, tz: process.env.TZ });

  const mon = new StreamMonitor({ maxToolCalls: cfg.limits.maxToolCalls, perRunUsd: cfg.limits.perRunUsd, worstCaseRequestUsd: cfg.limits.worstCaseRequestUsd });
  log("started", { model: `${cfg.model.provider}/${cfg.model.id}`, limits: cfg.limits });
  const child = spawn(cfg.paths.bwrap || "/usr/bin/bwrap", bw, { stdio: ["pipe", "pipe", "inherit"] });
  process.stdin.pipe(child.stdin); child.stdin.on("error", () => {});

  let killedFor = null;
  const kill = (reason) => { if (killedFor) return; killedFor = reason; log("limit", { reason }); child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 10_000).unref(); };
  const deadline = setTimeout(() => kill(`deadline ${cfg.limits.deadlineSec}s exceeded`), cfg.limits.deadlineSec * 1000);
  for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => kill(`cancelled by ${s}`));

  let buf = "";
  child.stdout.on("data", (d) => {
    process.stdout.write(d); buf += d.toString("utf8");
    let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const r = mon.observe(line); if (r.kill) kill(r.reason); }
  });
  const code = await new Promise((res) => child.on("close", (c, sig) => res(c ?? (sig ? 128 : 1))));
  clearTimeout(deadline);

  const out = killedFor ? { status: "failed", reason: killedFor } : (code === 0 ? mon.outcome() : { status: "failed", reason: `child exit ${code}` });
  const artifact = path.join(process.cwd(), "report.md");
  const hasArtifact = fs.existsSync(artifact);
  const reserved = Math.max(mon.costUsd, 0); // conservative: unknown cost already fails closed in monitor
  log(out.status === "succeeded" ? "completed" : "failed", { reason: out.reason, tool_calls: mon.toolCalls, turns: mon.turns, usage: mon.usage, cost_usd: mon.costUsd, duration_ms: Date.now() - t0, artifact: hasArtifact ? "report.md" : null, artifact_sha256: hasArtifact ? crypto.createHash("sha256").update(fs.readFileSync(artifact)).digest("hex") : null });
  ledger({ status: out.status, cost_usd: reserved, cost_usd_reserved: mon.budget.unknown ? cfg.limits.perRunUsd : reserved });
  if (killedFor) fail(4, `stopped: ${killedFor}`);
  if (out.status !== "succeeded") fail(5, `run failed: ${out.reason}`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => fail(5, `internal error: ${e.message}`));
