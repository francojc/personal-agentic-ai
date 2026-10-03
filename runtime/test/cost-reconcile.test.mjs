import test from "node:test";
import assert from "node:assert/strict";
import { reconcileRun } from "../cost-reconcile.mjs";

const events = [
  { type: "started", time: "2026-10-03T12:00:00.000Z" },
  { type: "usage", time: "2026-10-03T12:01:00.000Z", cost_usd: 0.2 },
  { type: "completed", time: "2026-10-03T12:02:00.000Z", cost_usd: 0.2 },
];
const row = (extra = {}) => ({
  timestamp: "2026-10-03T12:01:30.000Z",
  virtual_key_name: "paos-worker", provider: "zen", model: "minimax-m2.7",
  token_usage: { input_tokens: 1000, output_tokens: 100 }, cost: 0.00042,
  ...extra,
});

test("reconcile unique Bifrost row and preserve independent cost bases", () => {
  const result = reconcileRun(events, [row()]);
  assert.equal(result.status, "matched");
  assert.equal(result.pi_estimated_cost_usd, 0.2);
  assert.equal(result.bifrost_reported_cost_usd, 0.00042);
  assert.equal(result.cost_delta_usd, -0.19958);
  assert.equal(result.human_acceptance, "not reviewed");
});

test("distinct Bifrost requests within run window are summed", () => {
  const second = row({ timestamp: "2026-10-03T12:01:45.000Z", cost: 0.00058 });
  const result = reconcileRun(events, [row(), second]);
  assert.equal(result.status, "matched");
  assert.equal(result.candidate_count, 2);
  assert.equal(result.bifrost_reported_cost_usd, 0.001);
});

test("ambiguous same-timestamp rows without request IDs are not double-counted", () => {
  const result = reconcileRun(events, [row(), row()]);
  assert.equal(result.status, "ambiguous");
  assert.equal(result.bifrost_reported_cost_usd, null);
  assert.equal(result.cost_delta_usd, null);
});

test("missing usage and missing price remain explicit", () => {
  assert.equal(reconcileRun(events, [row({ token_usage: undefined })]).status, "missing_usage");
  assert.equal(reconcileRun(events, [row({ cost: 0 })]).bifrost_reported_cost_usd, 0);
  assert.equal(reconcileRun(events, [row({ cost: undefined })]).status, "missing_cost");
});

test("rows outside run time window or wrong VK are not matched", () => {
  const result = reconcileRun(events, [row({ timestamp: "2026-10-03T12:03:00.000Z" }), row({ virtual_key_name: "other" })]);
  assert.equal(result.status, "missing");
  assert.equal(result.human_acceptance, "not reviewed");
});
