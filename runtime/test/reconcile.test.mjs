import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reconcile } from "../reconcile.mjs";

function setup(lines) { const d = fs.mkdtempSync(path.join(os.tmpdir(), "rec-")); fs.mkdirSync(path.join(d, "runs")); fs.writeFileSync(path.join(d, "runs/2026-10.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n"); return d; }
const ev = (run_id, type, extra = {}) => ({ run_id, type, seq: 1, ...extra });

test("started without terminal => interrupted, ledgered with last cost + margin", () => {
  const d = setup([ev("a", "started"), ev("a", "usage", { cost_usd: 0.12 }), ev("a", "usage", { cost_usd: 0.2 })]);
  fs.mkdirSync(path.join(d, "agent-x")); fs.mkdirSync(path.join(d, "gate-y")); fs.mkdirSync(path.join(d, "home"));
  const r = reconcile({ stateDir: d, margin: 0.03 }); assert.equal(r.length, 1); assert.ok(Math.abs(r[0].reserved - 0.23) < 1e-9);
  const led = JSON.parse(fs.readFileSync(path.join(d, "ledger.jsonl"), "utf8").trim()); assert.equal(led.status, "interrupted"); assert.equal(led.month, "2026-10");
  assert.deepEqual(fs.readdirSync(d).sort(), ["home", "ledger.jsonl", "runs"]); // stale dirs gone, home kept
  assert.equal(reconcile({ stateDir: d, margin: 0.03 }).length, 0); // idempotent: now has terminal event
});
test("completed/failed runs and policy-held (never started) runs are untouched", () => {
  const d = setup([ev("a", "started"), ev("a", "completed"), ev("b", "started"), ev("b", "failed"), ev("c", "held")]);
  assert.equal(reconcile({ stateDir: d, margin: 0.03 }).length, 0); assert.equal(fs.existsSync(path.join(d, "ledger.jsonl")), false);
});
test("no usage events => reserves one worst-case request", () => {
  const d = setup([ev("a", "started")]); assert.equal(reconcile({ stateDir: d, margin: 0.03 })[0].reserved, 0.03);
});
test("missing state dir is fine", () => { assert.deepEqual(reconcile({ stateDir: path.join(os.tmpdir(), "nope-" + Date.now()), margin: 0.03 }), []); });
