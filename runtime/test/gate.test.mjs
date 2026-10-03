import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SensitivityGate } from "../gate.mjs";
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
const state = (d) => fs.readFileSync(path.join(d, "state"), "utf8");

test("starts public; private label mid-run violates immediately", async () => {
  const d = dir(); let v = null; let next = "public";
  const g = new SensitivityGate({ dir: d, resolve: async () => next, onViolation: (r) => (v = r) });
  assert.equal(state(d), "public"); assert.equal((await g.check()).ok, true);
  next = "private"; assert.equal((await g.check()).ok, false); assert.match(v, /private/); assert.equal(state(d), "hold:private");
  next = "public"; assert.equal((await g.check()).ok, false); // tightening is terminal: cannot self-heal
});
test("removing the public label (unknown) also violates", async () => {
  const d = dir(); let v = null; const g = new SensitivityGate({ dir: d, resolve: async () => "unknown", onViolation: (r) => (v = r) });
  assert.equal((await g.check()).ok, false); assert.match(v, /unknown/);
});
test("transient lookup errors blocked immediately but killed only after maxErrors", async () => {
  const d = dir(); let v = null; let n = 0; const g = new SensitivityGate({ dir: d, maxErrors: 3, resolve: async () => { n++; throw new Error("net"); }, onViolation: (r) => (v = r) });
  let r = await g.check(); assert.equal(r.degraded, true); assert.equal(state(d), "hold:lookup-error"); assert.equal(v, null);
  await g.check(); assert.equal(v, null); await g.check(); assert.notEqual(v, null);
});
test("recovery from a transient error resets the counter", async () => {
  const d = dir(); const seq = ["error", "error", "public", "error", "error", "public"]; let i = 0; let v = null;
  const g = new SensitivityGate({ dir: d, maxErrors: 3, resolve: async () => { const s = seq[i++]; if (s === "error") throw new Error("x"); return s; }, onViolation: (r) => (v = r) });
  for (let k = 0; k < 6; k++) await g.check(); assert.equal(v, null); assert.equal(state(d), "public");
});
