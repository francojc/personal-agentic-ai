#!/usr/bin/env node
// Metadata-only PAOS/Bifrost cost reconciliation. Credentials supplied via environment, never logged.
import fs from "node:fs";
import path from "node:path";
import { reconcileRun } from "../runtime/cost-reconcile.mjs";

const runsDir = process.env.PAOS_RUNS_DIR || "/var/lib/paos/runs";
const baseUrl = process.env.BIFROST_BASE_URL || "http://127.0.0.1:8081";
const user = process.env.BIFROST_ADMIN_USERNAME;
const password = process.env.BIFROST_ADMIN_PASSWORD;
if (!user || !password) {
  console.error("Set BIFROST_ADMIN_USERNAME and BIFROST_ADMIN_PASSWORD in protected environment.");
  process.exit(2);
}

async function fetchLogs() {
  const all = [];
  let offset = 0;
  while (true) {
    const url = new URL("/api/logs", baseUrl);
    url.searchParams.set("limit", "500");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` } });
    if (!response.ok) throw new Error(`Bifrost logs API returned HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.logs)) throw new Error("Bifrost logs response missing logs array");
    all.push(...body.logs);
    offset += body.logs.length;
    const total = Number(body.pagination?.total_count);
    if (!body.logs.length || !Number.isFinite(total) || offset >= total) break;
  }
  return all;
}

try {
  const logs = await fetchLogs();
  const events = new Map();
  for (const name of fs.readdirSync(runsDir).filter((n) => n.endsWith(".jsonl")).sort()) {
    for (const line of fs.readFileSync(path.join(runsDir, name), "utf8").split("\n").filter(Boolean)) {
      try {
        const event = JSON.parse(line);
        if (event.run_id) events.set(event.run_id, [...(events.get(event.run_id) || []), event]);
      } catch { /* Ignore incomplete/corrupt JSONL row; no secrets or payloads are printed. */ }
    }
  }
  const rows = [...events].filter(([, es]) => es.some((e) => e.type === "started"))
    .map(([run_id, es]) => ({ run_id, issue_id: es.find((e) => e.type === "started")?.issue_id ?? null, ...reconcileRun(es, logs) }));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), run_count: rows.length, rows }, null, 2)}\n`);
} catch (error) {
  console.error(`PAOS cost report failed: ${error.message}`);
  process.exit(1);
}
