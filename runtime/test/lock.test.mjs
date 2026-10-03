import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireLock } from "../lock.mjs";
const f = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lock-")), "run.lock");

test("second acquire fails while holder alive", () => { const p = f(); const a = acquireLock(p, { pid: 111, alive: () => true }); assert.equal(a.ok, true); assert.equal(acquireLock(p, { pid: 222, alive: () => true }).ok, false); a.release(); assert.equal(acquireLock(p, { pid: 222, alive: () => true }).ok, true); });
test("stale lock (dead pid) is reclaimed", () => { const p = f(); fs.writeFileSync(p, "999999"); assert.equal(acquireLock(p, { pid: 5, alive: () => false }).ok, true); });
test("garbage lock content is reclaimed", () => { const p = f(); fs.writeFileSync(p, "not-a-pid"); assert.equal(acquireLock(p, { pid: 5 }).ok, true); });
test("release only removes own lock", () => { const p = f(); const a = acquireLock(p, { pid: 1, alive: () => true }); fs.writeFileSync(p, "2"); a.release(); assert.equal(fs.existsSync(p), true); });
