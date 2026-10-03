import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ext from "../extensions/paos-research.mjs";

function load(gateContent) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ext-")), "state"); if (gateContent !== null) fs.writeFileSync(f, gateContent);
  process.env.PAOS_GATE_FILE = f; const tools = {}; const on = {};
  ext({ registerTool: (t) => (tools[t.name] = t), on: (n, h) => (on[n] = h) });
  return { tools, on, f };
}

test("registers exactly the three research tools", () => { assert.deepEqual(Object.keys(load("public").tools).sort(), ["web_fetch", "web_search", "write_report"]); });
test("open gate: allowed tools pass, others blocked", async () => {
  const { on } = load("public");
  assert.equal(await on.tool_call({ toolName: "web_fetch" }), undefined);
  assert.equal((await on.tool_call({ toolName: "bash" })).block, true);
  assert.equal((await on.tool_call({ toolName: "read" })).block, true);
});
test("closed, missing or garbled gate blocks every tool call", async () => {
  for (const g of ["hold:private", "hold:lookup-error", "", null, "publicX"]) { const { on } = load(g); assert.equal((await on.tool_call({ toolName: "web_fetch" })).block, true, String(g)); }
});
test("closed gate withholds the provider payload; open gate leaves it untouched", () => {
  const payload = { model: "m", messages: [{ role: "user", content: "SECRET" }], tools: [{}], tool_choice: "auto" };
  const closed = load("hold:private").on.before_provider_request({ payload });
  assert.equal(JSON.stringify(closed).includes("SECRET"), false); assert.equal(closed.messages.length, 1); assert.equal(closed.tools, undefined);
  assert.equal(load("public").on.before_provider_request({ payload }), undefined);
});
test("write_report writes only report.md in cwd, atomically", async () => {
  const { tools } = load("public"); const d = fs.mkdtempSync(path.join(os.tmpdir(), "rep-")); const old = process.cwd(); process.chdir(d);
  try { await tools.write_report.execute("1", { content: "# x\nhttps://example.com" }); assert.deepEqual(fs.readdirSync(d), ["report.md"]); await assert.rejects(tools.write_report.execute("2", { content: "  " }), /empty/); }
  finally { process.chdir(old); }
});

test("in-sandbox tool-call cap blocks call N+1", async () => {
  process.env.PAOS_MAX_TOOL_CALLS = "2"; const { on } = load("public");
  assert.equal(await on.tool_call({ toolName: "web_fetch" }), undefined); assert.equal(await on.tool_call({ toolName: "web_fetch" }), undefined);
  assert.match((await on.tool_call({ toolName: "web_fetch" })).reason, /limit/); delete process.env.PAOS_MAX_TOOL_CALLS;
});
