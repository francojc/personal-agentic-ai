// Single-run lock with stale-PID recovery (concurrency = 1).
import fs from "node:fs";

export function acquireLock(file, { pid = process.pid, alive = (p) => { try { process.kill(p, 0); return true; } catch (e) { return e.code === "EPERM"; } } } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { fs.writeFileSync(file, String(pid), { flag: "wx", mode: 0o600 }); return { ok: true, release: () => { try { if (fs.readFileSync(file, "utf8") === String(pid)) fs.unlinkSync(file); } catch {} } }; }
    catch (e) {
      if (e.code !== "EEXIST") return { ok: false, reason: e.message };
      const holder = Number(fs.readFileSync(file, "utf8").trim());
      if (Number.isInteger(holder) && holder > 0 && alive(holder)) return { ok: false, reason: `held by pid ${holder}` };
      try { fs.unlinkSync(file); } catch {} // stale (dead holder or garbage): reclaim once
    }
  }
  return { ok: false, reason: "could not reclaim lock" };
}
