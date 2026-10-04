# Personal Agentic AI

Operator-led learning lab, built from zero: **Proxmox QEMU VM 200**, Debian 13, default **Zsh**, Docker, Tailscale, Bifrost, and Multica.

Hostname is **paos** in Proxmox, Debian, and Tailscale. Private web names: **paos** for Multica via node-level Serve, **gateway** for Bifrost via named Tailscale Service – both HTTPS 443. SSH connects to same **paos** device.

**Start:** [plan](PLAN.md) → [phased runbook](RUNBOOK.md).

You perform setup. Assistant explains and troubleshoots. Nothing here automatically provisions hosts or runs agents.

## Repository

| File | Purpose |
|---|---|
| `PLAN.md` | Scope, phases, gates, deferred work |
| `RUNBOOK.md` | Manual steps, browser/VM lessons, checks and recovery |
| `compose.yaml` | Bifrost only; separate upstream Multica project |
| `.env.example` | Fresh Bifrost environment template |
| `config/bifrost/config.json` | Authentication/logging bootstrap; UI remains database-backed |
| `multica.env.example` | Fresh upstream Multica environment template |

No old worker, deployment automation, mock provider, or workshop stack needed. Previous work remains in Git history.

Local ignored `.env`, workspace files, and caches may remain from previous use. They are not fresh-build inputs. Never copy old secrets blindly or commit local data.

Examples are source-reviewed, not a claim of tested deployment. Stop when checkpoint fails. Never use Funnel, expose databases, or delete volumes as troubleshooting.
