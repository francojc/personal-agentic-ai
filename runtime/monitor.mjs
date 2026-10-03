// Observes Pi's JSONL stream (outside the sandbox) and enforces limits. Pure/testable.
import { RunBudget, ToolCounter } from "./policy.mjs";

export class StreamMonitor {
  constructor({ maxToolCalls, perRunUsd, worstCaseRequestUsd }) {
    this.tools = new ToolCounter(maxToolCalls); this.budget = new RunBudget({ perRunUsd, worstCaseRequestUsd });
    this.toolCalls = 0; this.turns = 0; this.lastStopReason = null; this.lastError = null; this.settled = false; this.malformed = 0;
    this.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  }
  /** Returns {kill:true, reason} when a limit is breached; otherwise {kill:false}. */
  observe(line) {
    let e; try { e = JSON.parse(line); } catch { this.malformed++; return this.malformed > 20 ? { kill: true, reason: "too many malformed protocol records" } : { kill: false }; }
    switch (e.type) {
      case "tool_execution_start": this.toolCalls++; if (!this.tools.next()) return { kill: true, reason: `tool-call limit (${this.tools.max}) exceeded` }; break;
      case "turn_end": {
        this.turns++; const m = e.message || {};
        this.lastStopReason = m.stopReason ?? null; this.lastError = m.stopReason === "error" ? (m.errorMessage || "error") : null;
        const u = m.usage; if (u) { for (const k of Object.keys(this.usage)) this.usage[k] += Number(u[k] || 0); }
        const st = this.budget.add(u?.cost?.total); if (!st.ok) return { kill: true, reason: st.reason };
        break;
      }
      case "agent_settled": this.settled = true; break;
    }
    return { kill: false };
  }
  /** Final classification: success only if settled with a non-error terminal turn. */
  outcome() {
    if (!this.settled) return { status: "failed", reason: "agent never settled" };
    if (this.lastStopReason === "error" || this.lastStopReason === "aborted") return { status: "failed", reason: `terminal stopReason=${this.lastStopReason}: ${this.lastError ?? ""}`.trim() };
    return { status: "succeeded" };
  }
  get costUsd() { return this.budget.spent; }
}
