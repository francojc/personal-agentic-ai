import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { runProvenance } from "../paos-pi.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("run provenance carries config hash, configured versions, and trusted issue marker", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paos-provenance-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, ".multica"));
  fs.writeFileSync(path.join(dir, ".multica/daemon_task_context.json"), JSON.stringify({
    managed_by: "multica-daemon-task", agent_id: "agent-1", issue_id: "issue-42",
  }));
  const configPath = path.join(root, "config/paos/worker.json.example");
  const cfg = { policyVersion: "0.1.0-test", componentVersions: { pi: "1.0.1", bifrost: "2.2.5" } };
  const result = runProvenance({ configPath, cfg, cwd: dir, env: { MULTICA_AGENT_ID: "agent-1" } });
  assert.equal(result.config_sha256, crypto.createHash("sha256").update(fs.readFileSync(configPath)).digest("hex"));
  assert.equal(result.policy_version, "0.1.0-test");
  assert.equal(result.component_versions.pi, "1.0.1");
  assert.equal(result.component_versions.bifrost, "2.2.5");
  assert.equal(result.issue_id, "issue-42");
});

test("pricing override is exact-model/provider scoped and uses token-rate units", () => {
  for (const file of ["config/paos/bifrost/config.json", "tests/mock/bifrost.config.json"]) {
    const config = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    const overrides = config.governance.pricing_overrides;
    assert.equal(overrides.length, 1);
    const override = overrides[0];
    assert.equal(override.scope_kind, "provider");
    assert.equal(override.provider_id, "zen");
    assert.equal(override.match_type, "exact");
    assert.equal(override.pattern, "minimax-m2.7");
    assert.deepEqual(override.request_types, ["chat_completion"]);
    assert.deepEqual(JSON.parse(override.pricing_patch), {
      input_cost_per_token: 3e-7,
      output_cost_per_token: 1.2e-6,
      cache_read_input_token_cost: 6e-8,
    });
  }
});
