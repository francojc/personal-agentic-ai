// Continuous sensitivity gate. The launcher (outside the sandbox) re-resolves labels while a run is
// active and publishes the verdict to <dir>/state, which the sandbox sees read-only at /gate.
// Labels only tighten: any non-public verdict is terminal for the run. A transient lookup failure
// ("error") is tolerated for a few consecutive checks, but outbound requests are blocked meanwhile.
import fs from "node:fs";
import path from "node:path";

export function writeGateState(dir, state) {
  const f = path.join(dir, "state"); const tmp = f + ".tmp";
  fs.writeFileSync(tmp, state, { mode: 0o644 }); fs.renameSync(tmp, f);
}

export class SensitivityGate {
  constructor({ dir, resolve, onViolation, intervalMs = 3000, maxErrors = 3 }) {
    Object.assign(this, { dir, resolve, onViolation, intervalMs, maxErrors }); this.errors = 0; this.violated = null; this.timer = null; this.busy = false;
    writeGateState(dir, "public");
  }
  start() { this.timer = setInterval(() => this.check(), this.intervalMs); this.timer.unref?.(); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async check() {
    if (this.violated || this.busy) return this.violated ? { ok: false, reason: this.violated } : { ok: true };
    this.busy = true;
    try {
      let s; try { s = await this.resolve(); } catch { s = "error"; }
      if (s === "public") { this.errors = 0; writeGateState(this.dir, "public"); return { ok: true }; }
      if (s === "error") {
        this.errors++; writeGateState(this.dir, "hold:lookup-error"); // block outbound while unverifiable
        if (this.errors < this.maxErrors) return { ok: true, degraded: true };
      }
      this.violated = `sensitivity became '${s}' during run`; writeGateState(this.dir, "hold:" + s); this.onViolation(this.violated);
      return { ok: false, reason: this.violated };
    } finally { this.busy = false; }
  }
}
