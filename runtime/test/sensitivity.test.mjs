import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveSensitivity, extractLabelNames, readMarker } from "../sensitivity.mjs";

const env = { MULTICA_AGENT_ID: "a1", MULTICA_TOKEN: "t" };
function workdir(marker) { const d = fs.mkdtempSync(path.join(os.tmpdir(), "paos-")); if (marker) { fs.mkdirSync(path.join(d, ".multica")); fs.writeFileSync(path.join(d, ".multica/daemon_task_context.json"), JSON.stringify(marker)); } return d; }
const good = { managed_by: "multica-daemon-task", agent_id: "a1", issue_id: "i1" };

test("extract label names from several shapes", () => {
  assert.deepEqual(extractLabelNames([{ name: "public" }]), ["public"]);
  assert.deepEqual(extractLabelNames({ labels: [{ name: "x" }] }), ["x"]);
  assert.deepEqual(extractLabelNames(["a"]), ["a"]);
  assert.equal(extractLabelNames({ foo: 1 }), null); assert.equal(extractLabelNames([{ id: 1 }]), null);
});
test("marker validation", () => {
  assert.equal(readMarker(workdir(null), env).ok, false);
  assert.equal(readMarker(workdir({ ...good, managed_by: "x" }), env).ok, false);
  assert.equal(readMarker(workdir({ ...good, issue_id: "" }), env).ok, false);
  assert.equal(readMarker(workdir({ ...good, agent_id: "other" }), env).ok, false);
  assert.equal(readMarker(workdir(good), env).issueId, "i1");
});
test("public only when label present and nothing tighter", async () => {
  const run = (labels) => async () => JSON.stringify(labels.map((name) => ({ name })));
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: run(["public"]) }), "public");
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: run(["public", "private"]) }), "private");
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: run([]) }), "unknown");
});
test("lookup failures are 'error'; missing marker is 'unknown' (both non-public)", async () => {
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: async () => { throw new Error("401"); } }), "error");
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: async () => "not json" }), "error");
  assert.equal(await resolveSensitivity({ env, cwd: workdir(good), run: async () => '{"x":1}' }), "error");
  assert.equal(await resolveSensitivity({ env, cwd: workdir(null), run: async () => "[]" }), "unknown");
});
test("child env never carries other secrets", async () => {
  let seen; await resolveSensitivity({ env: { ...env, BIFROST_ENCRYPTION_KEY: "boom", ZEN_API_KEY: "boom" }, cwd: workdir(good), run: async (b, a, e) => { seen = e; return "[]"; } });
  assert.deepEqual(Object.keys(seen).sort(), ["HOME", "MULTICA_AGENT_ID", "MULTICA_SERVER_URL", "MULTICA_TASK_ID", "MULTICA_TOKEN", "MULTICA_WORKSPACE_ID", "PATH"]);
});
