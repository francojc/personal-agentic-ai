import test from "node:test";
import assert from "node:assert/strict";
import { parseMulticaArgs, evaluateLaunch, classifyLabels, isPrivateIp, checkUrlStatic, RunBudget, monthlyAllowance, ToolCounter } from "../policy.mjs";

const config = { allowedAgentIds: ["agent-1"], allowedWorkspaceIds: ["ws-1"] };
const env = { MULTICA_TASK_ID: "t", MULTICA_AGENT_ID: "agent-1", MULTICA_WORKSPACE_ID: "ws-1" };

test("args: accepts Multica's invocation, ignores model, rejects extras", () => {
  const a = parseMulticaArgs(["-p", "--mode", "json", "--session", "/x/s.jsonl", "--model", "evil/model", "--thinking", "high"]);
  assert.equal(a.session, "/x/s.jsonl"); assert.deepEqual(a.ignored, ["--model", "evil/model", "--thinking", "high"]);
  assert.throws(() => parseMulticaArgs(["-p", "--mode", "json", "--session", "s", "--tools", "bash"]), /unsupported/);
  assert.throws(() => parseMulticaArgs(["-p", "--mode", "rpc", "--session", "s"]), /json/);
  assert.throws(() => parseMulticaArgs(["-p", "--mode", "json"]), /session/);
});

test("launch: only explicit public, allow-listed, complete metadata", () => {
  assert.equal(evaluateLaunch({ env, config, sensitivity: "public" }).allow, true);
  for (const s of ["private", "unknown", undefined, "PUBLIC"]) assert.equal(evaluateLaunch({ env, config, sensitivity: s }).allow, false, String(s));
  assert.equal(evaluateLaunch({ env: { ...env, MULTICA_AGENT_ID: "other" }, config, sensitivity: "public" }).allow, false);
  assert.equal(evaluateLaunch({ env: { ...env, MULTICA_TASK_ID: "" }, config, sensitivity: "public" }).allow, false);
  assert.equal(evaluateLaunch({ env: { ...env, MULTICA_WORKSPACE_ID: "ws-2" }, config, sensitivity: "public" }).allow, false);
});

test("labels only tighten", () => {
  assert.equal(classifyLabels(["public"]), "public");
  assert.equal(classifyLabels(["public", "private"]), "private");
  assert.equal(classifyLabels(["Sensitive", "public"]), "private");
  assert.equal(classifyLabels([]), "unknown");
  assert.equal(classifyLabels(["research"]), "unknown");
});

test("private address detection incl. tailnet CGNAT, mapped v6", () => {
  for (const ip of ["10.0.4.1", "127.0.0.1", "169.254.169.254", "100.87.240.29", "172.20.1.1", "192.168.1.1", "::1", "fd7a:115c:a1e0::1", "::ffff:10.0.0.1", "fe80::1"]) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("url static check", () => {
  for (const u of ["file:///etc/passwd", "http://localhost/x", "http://127.0.0.1/", "http://[::1]/", "https://user:pw@example.com/", "http://example.com:8080/", "http://paos-control.gerbil-matrix.ts.net/", "http://intranet/", "http://169.254.169.254/latest", "ftp://example.com"]) assert.equal(checkUrlStatic(u).ok, false, u);
  assert.equal(checkUrlStatic("https://example.com/a?b=1").ok, true);
});

test("run budget fails closed on unknown cost and on margin", () => {
  const b = new RunBudget({ perRunUsd: 0.5, worstCaseRequestUsd: 0.03 });
  assert.equal(b.add(0.2).ok, true); assert.equal(b.add(0.28).ok, false); // 0.48 + 0.03 margin > 0.5
  const c = new RunBudget({ perRunUsd: 0.5, worstCaseRequestUsd: 0.03 });
  assert.equal(c.add(undefined).ok, false);
});

test("monthly allowance counts UTC month and treats corrupt lines as worst case", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  const lines = [JSON.stringify({ month: "2026-10", cost_usd: 18 }), JSON.stringify({ month: "2026-09", cost_usd: 100 })];
  assert.equal(monthlyAllowance({ ledgerLines: lines, monthlyUsd: 18.2, perRunUsd: 0.5, now }).ok, false);
  assert.equal(monthlyAllowance({ ledgerLines: [lines[1]], monthlyUsd: 19, perRunUsd: 0.5, now }).ok, true);
  assert.equal(monthlyAllowance({ ledgerLines: ["{broken"], monthlyUsd: 0.4, perRunUsd: 0.5, now }).ok, false);
});

test("tool counter caps at max", () => { const c = new ToolCounter(2); assert.deepEqual([c.next(), c.next(), c.next()], [true, true, false]); });
