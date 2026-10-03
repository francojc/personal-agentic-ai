// Crash/cancel reconciliation. Multica cancels by hard-killing the launcher, so a run can end with
// no terminal record. Called by the NEXT launch while holding the run lock (=> no live run exists).
// Interrupted runs are ledgered conservatively: last known cumulative cost + one worst-case request.
import fs from "node:fs";
import path from "node:path";

const TERMINAL = new Set(["completed", "failed", "interrupted"]);

export function reconcile({ stateDir, margin, now = new Date() }) {
  const runsDir = path.join(stateDir, "runs"); const out = [];
  if (fs.existsSync(runsDir)) {
    const byRun = new Map();
    for (const f of fs.readdirSync(runsDir).filter((x) => x.endsWith(".jsonl")).sort()) {
      for (const line of fs.readFileSync(path.join(runsDir, f), "utf8").split("\n").filter(Boolean)) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        const r = byRun.get(e.run_id) ?? { file: f, started: false, terminal: false, cost: 0, seq: 0 };
        if (e.type === "started") r.started = true;
        if (TERMINAL.has(e.type)) r.terminal = true;
        if (e.type === "usage" && Number.isFinite(e.cost_usd)) r.cost = Math.max(r.cost, e.cost_usd);
        r.seq = Math.max(r.seq, e.seq || 0); byRun.set(e.run_id, r);
      }
    }
    const ledger = path.join(stateDir, "ledger.jsonl");
    for (const [runId, r] of byRun) {
      if (!r.started || r.terminal) continue;
      const reserved = r.cost + margin; const month = r.file.slice(0, 7);
      fs.appendFileSync(path.join(runsDir, r.file), JSON.stringify({ schema_version: 1, run_id: runId, seq: r.seq + 1, time: now.toISOString(), type: "interrupted", reason: "no terminal record (cancelled, crashed or hard-killed)", cost_usd: r.cost, cost_usd_reserved: reserved }) + "\n");
      fs.appendFileSync(ledger, JSON.stringify({ month, run_id: runId, status: "interrupted", cost_usd: r.cost, cost_usd_reserved: reserved }) + "\n");
      out.push({ runId, reserved });
    }
  }
  for (const d of fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : []) if (/^(agent|gate)-/.test(d)) fs.rmSync(path.join(stateDir, d), { recursive: true, force: true });
  return out;
}
