import test from "node:test";
import assert from "node:assert/strict";
import { StreamMonitor } from "../monitor.mjs";
const mk = () => new StreamMonitor({ maxToolCalls: 2, perRunUsd: 0.5, worstCaseRequestUsd: 0.03 });
const turn = (cost, stopReason = "stop") => JSON.stringify({ type: "turn_end", message: { stopReason, usage: { input: 10, output: 5, cost: { total: cost } } } });

test("tool-call cap", () => { const m = mk(); const t = JSON.stringify({ type: "tool_execution_start" }); assert.equal(m.observe(t).kill, false); assert.equal(m.observe(t).kill, false); assert.equal(m.observe(t).kill, true); });
test("budget kill", () => { const m = mk(); assert.equal(m.observe(turn(0.2)).kill, false); assert.equal(m.observe(turn(0.3)).kill, true); });
test("unknown cost fails closed", () => { const m = mk(); assert.equal(m.observe(JSON.stringify({ type: "turn_end", message: { stopReason: "stop", usage: { input: 1 } } })).kill, true); });
test("success requires settled and non-error terminal turn", () => {
  const m = mk(); m.observe(turn(0.01)); assert.equal(m.outcome().status, "failed"); m.observe('{"type":"agent_settled"}'); assert.equal(m.outcome().status, "succeeded");
  const e = mk(); e.observe(turn(0.01, "error")); e.observe('{"type":"agent_settled"}'); assert.equal(e.outcome().status, "failed");
});
test("retry then success clears terminal error (last turn wins)", () => { const m = mk(); m.observe(turn(0.01, "error")); m.observe(turn(0.01, "stop")); m.observe('{"type":"agent_settled"}'); assert.equal(m.outcome().status, "succeeded"); });
test("malformed records tolerated then fail closed", () => { const m = mk(); let k = false; for (let i = 0; i < 25; i++) k = m.observe("{bad").kill || k; assert.equal(k, true); });
