# PAOS learning-first plan

## Scope

Build from zero on **Proxmox QEMU VM 200**, hostname `paos`, Debian 13 with **Zsh** as default login shell. Jerid performs every setup step; assistant supplies documentation and focused troubleshooting. No inherited installation, accounts, secrets, labels, worker code, or live state assumed.

Core: Proxmox VM, Docker, host-level Tailscale, Bifrost, upstream Multica, recoverable state. First milestone is understanding both private web interfaces and their VM services, not autonomous research.

## Phases and gates

| Phase | Result | Gate |
|---|---|---|
| 0 | Fresh-start decisions | Previous VMs removed; VM 200 available; paos/gateway names reserved |
| 1 | Debian VM and SSH | Capacity checked; console and key access work |
| 2 | Private networking | Tailnet policy, SSH, HTTPS prerequisites verified |
| 3 | Docker and repo | Root-equivalent admin access understood; fresh secrets |
| 4 | Bifrost | Private authenticated UI; persistence demonstrated |
| 5 | Multica | Private UI, account, health, origin and WebSocket routing |
| 6 | Recovery | Independent encrypted backup restored into isolated guest |
| 7 | One manual provider test | Explicit paid-call approval; verified spend controls |
| 8 | Worker experiment | Dedicated user, capability/egress limits, cancellation, synthetic acceptance |
| 9 | Optional interfaces | Add one only for concrete learning/workflow need |

Follow [RUNBOOK.md](RUNBOOK.md). Stop after each checkpoint. Each session records browser observation, VM observation, change, reversal, and next step.

## Lessons retained

- Two separate Compose projects; never merge vendor Compose into ours.
- Host Tailscale Serve: Multica on VM device name **paos**, Bifrost on named Tailscale Service **gateway**, both HTTPS 443. Tagged guest hosts gateway; no duplicate svc:paos, Docker socket proxy, or public publication.
- Stable encryption/signing secrets; do not regenerate against existing data.
- Default Bifrost database-backed UI configuration; no provider/model locks imposed before learning UI.
- Multica server coordinates; daemon executes with its Unix user's permissions.
- Labels and prompts are not security boundaries. No custom enforcement exists in fresh baseline.
- Gateway cost for custom providers can be zero/wrong; budget configuration alone is not proof.
- No provider fallbacks for private data. Sensitive input stays home; absent approved local route means hold.
- Snapshot is rollback convenience, not independent recovery.
- Pin versions, recheck compatibility, upgrade one service at a time.

## Deferred

No custom PAOS launcher, classifiers, vector memory, Redis, GPU VPS, dashboards, MCP bridge, browser shell, search backend, or autonomous workflows in initial build. These require separate scoped lessons, not a hidden deployment queue.

Previous prototype source remains in Git history, not active runbook dependencies. Deleted deployment notes are not current evidence.
