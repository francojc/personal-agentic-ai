# PAOS deployment decisions

## Status

Tier 0 steps 1–4 complete: discovery, candidate pins, runtime contract and gateway/tool ownership documented. Step 5 provisioning/recovery gate approved; Debian guest provisioning next. This is not an installation guide yet. Existing setup scripts still launch the legacy stack and must not be used for PAOS.

## Approved decisions

| Item | Decision |
|---|---|
| Target | New minimal Debian 13 amd64 VM on Proxmox; no desktop |
| Allocation | 4 vCPU, 8 GiB RAM, 96 GiB NVMe-backed disk; preserve host reserve and existing guests |
| First workflow | Public research → cited report inside restricted workspace |
| Provider/budget | OpenCode Zen; $20/month total, $0.50/run; exact model pending compatibility review |
| Execution limits | One active run, 15 minutes, 30 tool calls, two transient retries per request; retries count toward limits |
| Privacy | Sensitive data must remain home-local; private/unknown tasks hold in v0.1; GPU VPS is not an eligible private route |
| Migration | Fresh PAOS state; wholesale legacy code/documentation replacement, legacy runtime data preserved untouched |
| Deployment topology | Two explicit Compose projects: PAOS and pinned upstream Multica |

## Blocking gates

- Confirm Multica ↔ Pi protocol support and exact model/gateway interoperability before provisioning.
- Define guest networking, administrator access and Tailnet enrollment before creating VM; no implicit Tailnet policy changes.
- Define encrypted independent backup destination, retention and secret recovery before real-data go-live.
- Locate any live legacy deployment before cutover; no shutdown/data deletion authorized by source-code replacement.
- Configure enforceable model budgets and reconcile reported versus estimated spend before paid workload tests.

Operator explicitly deferred backup/network/admin details to the deployment gate. Sanitized host inventory lives in gitignored `discovery.local.md`; no credentials or private infrastructure identifiers belong here.

## Recovery inventory and rollback proposal

- Operator confirmed legacy deployment exists only on this Mac/OrbStack and must remain untouched. Local workspace and TSDProxy configuration directories exist; `.env` values have not been read or copied. Docker daemon is unavailable, so named-volume contents and live container state are unverified.
- No state migration requested. Preserve original checkout/history, legacy workspace, protected environment files, gateway encryption key, and any old named volumes. Do not reset Bifrost encryption keys in an existing volume.
- Deploy fresh PAOS into a new VM with unique project/state names. Do not attach or reuse old data volumes. Save image/source pins and deployment configuration outside disposable runtime state.
- Before cutover, locate old deployment, export its application state with matching encryption/signing secrets into encrypted backup, and prove restore if rollback depends on it. No teardown is currently authorized.
- If new pilot fails, stop new workload and leave guest/state intact for diagnosis; retain old environment unchanged. DNS/Tailnet redirection requires a recorded reversal. Do not roll back a migrated database merely by downgrading its image.
- Independent encrypted backup destination/retention and secret escrow remain operator-deferred; synthetic public-data setup may proceed only after provisioning/access approval, but real-data go-live remains blocked.

## Approved provisioning gate

Operator authorized new VM creation with approved allocation, existing `vmbr0` bridge and DHCP, hostname `paos-control`, key-only `paos` administrator using the public key of the current Proxmox SSH identity, separate unprivileged worker, and interactive Tailscale enrollment. Never copy the private SSH key. Recheck unused VM ID before creation. Existing Mac/OrbStack deployment remains untouched; cutover/deletion not authorized. Independent encrypted backup and retention remain blocked for real-data go-live.

No Debian image currently available in inspected Proxmox installation-media inventory. Download only an official Debian 13 amd64 image, verify published integrity/authenticity, and record exact source/checksum before importing; do not reuse existing Ubuntu media.

No paid model calls until Zen credential is configured securely, auto-reload disabled, usage limits active and conservative per-run accounting validated. No legacy shutdown, volume deletion or Tailnet node deletion approved.

## Provisioned guest (step 6, 2026-10-03)

| Item | Value |
|---|---|
| Proxmox VM | ID 103 `paos-control`; 4 vCPU (host CPU type), 8 GiB fixed RAM (balloon off), 96 GiB `local-lvm` disk, VirtIO NIC on existing bridge, `onboot` enabled, guest agent running |
| Image | Official Debian 13 `genericcloud-amd64.qcow2` (`latest` index dated 2026-10-01); SHA512 verified against `SHA512SUMS` fetched over HTTPS. No detached signature was published at that index, so provenance rests on TLS + checksum |
| Software | Docker Engine 29.8.2, Compose 5.6.0, Tailscale 1.102.4 from official apt repositories (Debian trixie); reproducible via `scripts/provision-guest.sh` |
| Identities | `paos` (key-only admin, sudo, docker); `paos-worker` (locked password, no sudo, no docker) |
| Network | DHCP on LAN bridge; Tailnet node `paos-control`; MagicDNS disabled on guest (`--accept-dns=false`); UFW default-deny, allow `tailscale0`, LAN SSH only from an explicit CIDR |
| Layout | `/srv/paos/{repo,secrets,backups}` owned by `paos` (secrets/backups 0700); `/srv/paos/workspaces` owned by `paos-worker` (0700). Docker data root stays on the 96 GiB root disk |
| Docker | json-file logs capped 10 MB x 3; `live-restore` on |

Admin SSH key is the operator's default public key (`~/.ssh/id_ed25519.pub`); Proxmox itself is reached through Tailscale SSH, so no key was inherited from there. Replace in cloud-init/`authorized_keys` if a dedicated key is preferred.

Open items: (1) disable Tailnet key expiry for `paos-control` and review ACL tags in the Tailscale admin console (operator action; no policy changed); (2) systemd-resolved listens on LLMNR 5355 – blocked by UFW, optionally disable; (3) the Docker-published-port/UFW bypass must be handled by loopback-only binds (verify in step 9/28); (4) no PAOS application services deployed yet.

## Compose topology (step 7)

Two projects, one wrapper: `scripts/paos.sh`. Never run bare `docker compose` or merge files.

| Project | Source | Notes |
|---|---|---|
| `paos` | `compose.paos.yaml` | Bifrost `v2.2.5` only for now; loopback-only publish; caps dropped, memory/PID/CPU limits |
| `multica` | `vendor/multica` at `v0.6.1` (`2ea01ae`), verified by `vendor-fetch` | Vendor compose unmodified; images tagged `v0.6.1`; its Postgres uses floating `pgvector/pgvector:pg17` – pin by digest in step 21 |

Secrets live in `/srv/paos/secrets/{paos,multica}.env` (0600, outside Git); `init-secrets` never overwrites. Commands: `vendor-fetch`, `init-secrets`, `config`, `up`, `stop`, `down` (never removes volumes), `status`, `logs`. Both projects validated and all pinned images publish `amd64` manifests (2026-10-03). Nothing started yet. The Multica daemon runs on the host as `paos-worker` (not in Compose), per upstream design.

## Services and worker runtime (step 8)

Running (2026-10-03): Multica `v0.6.1` (`readyz` db+migrations ok, frontend 200) and Bifrost `v2.2.5` (healthy), all bound to loopback. Not yet configured: Bifrost provider/VK, Multica workspace/agent (steps 9–12).

Worker runtime (root-owned, `/opt/paos`): Node `v22.23.3`, Pi `1.0.1` (`--ignore-scripts`), Multica CLI `0.6.1` (checksum-verified), `bubblewrap 0.12.0`; installed by `scripts/install-worker-runtime.sh`. Launcher and policy code in `runtime/` installed by `scripts/install-worker-config.sh`; config `/etc/paos/worker.json` (template `config/paos/worker.json.example`); state/ledger `/var/lib/paos`.

Design as built:
- Multica daemon runs on the host as `paos-worker` (`config/paos/multica-daemon.service`, concurrency 1) with `MULTICA_PI_PATH` pointing at `runtime/paos-pi.mjs`, so Multica's native Pi backend executes our launcher, never raw `pi`.
- Launcher: validates args (rejects everything but Multica's invocation; model is forced), requires an allow-listed agent and `public` sensitivity (unresolved = HOLD, exit 3), checks the monthly ledger, takes a single-run lock, then runs Pi inside `bwrap` (cleared env, only `/work`, session file, read-only runtime/config, no `/home`, `/srv`, Docker socket or Multica token). Tools: `web_search`, `web_fetch`, `write_report` only.
- Limits enforced outside the sandbox from Pi's JSONL stream: 900 s deadline, 30 tool calls, per-run cost with a worst-case-request margin (unknown cost fails closed), cancellation via signals; success requires `agent_settled` and a non-error terminal turn.
- Metadata-only JSONL under `/var/lib/paos/runs/` and a spend ledger; no prompts or fetched pages logged.
- Unit tests: `node --test runtime/test/*.test.mjs` (18 passing locally and on the guest).

Known gaps carried to later steps: sensitivity resolver (`runtime/sensitivity.mjs` is a stub returning `unknown`; step 10), gateway key/VK and filtered gateway port (steps 9/11), per-uid network egress rules (step 11), live end-to-end run (step 12).

## Access layout (step 9)

One origin: `https://paos-control.<tailnet>.ts.net` (guest-level `tailscale serve`, tailnet-only, no Funnel; `scripts/tailnet-serve.sh`). Routes: `/health`, `/ws`, `/api/daemon/ws` -> Multica backend `127.0.0.1:8080`; everything else -> frontend `127.0.0.1:3000`. Multica `.env` sets `FRONTEND_ORIGIN`, `MULTICA_APP_URL`, `MULTICA_PUBLIC_URL` to that origin and `MULTICA_TRUSTED_PROXIES=127.0.0.1/32`; `/api/config` reports the same daemon URL.

Verified 2026-10-03 from the operator workstation: `/health` 200 (commit matches pin), `/` and `/api/config` 200 with a valid certificate, `/ws` and `/api/daemon/ws` reach the backend (400/401, not the frontend). From the Proxmox LAN only SSH (22) is open; 3000/8080/8081/5432 are closed. Postgres is unpublished. Bifrost admin remains loopback-only.

Sign-in: `ALLOW_SIGNUP=true` is limited by `ALLOWED_EMAILS` (set to the operator's address; no email service, so the verification code is read from backend logs). Set `ALLOW_SIGNUP=false` after the first account exists. The first-time Bifrost setup token and admin credentials are an operator step (never given to the worker; step 11 blocks the worker uid from loopback admin ports).

## Sensitivity labels and live policy test (step 10)

Sensitivity is human-applied Multica issue labels, resolved by the launcher (outside the sandbox) with the daemon's task-scoped token. The issue id comes from the daemon-written `.multica/daemon_task_context.json` (`managed_by`, `agent_id`, `issue_id`), never from the prompt; chat/autopilot runs have no issue and therefore hold. Labels: `public` (explicit allow), `private` (home-local; hold). Any `private`/`sensitive` label wins over `public`; no label, unresolved, or any resolver error = `unknown` = hold. Privacy and agent/workspace allow-listing are independent checks; consequential actions are not exposed to this worker at all in v0.1.

Live results on the pinned stack (2026-10-03), workspace `PAOS`, agent `Research Scout` (allow-listed in `/etc/paos/worker.json`):

| Issue labels | Decision |
|---|---|
| none | HOLD (`unknown`), exit 3 |
| `public` | allowed (run proceeded to the gateway-key step; nothing sent outbound because no key exists yet) |
| `public` + `private` | HOLD (`private`), exit 3 |

Operational notes: Multica shows a held run as a failed task ("pi exited with error: exit status 3"); the reason is in `/var/lib/paos/runs/<month>.jsonl` (`held`/`policy_decision`). A bug found and fixed during this test: a run lock left behind after an internal error; the launcher now releases the lock on any exit and reclaims stale locks (`runtime/lock.mjs`, tested). Signup is now closed (`ALLOW_SIGNUP=false`); sign in with the allow-listed email using the code from `./scripts/paos.sh logs multica backend`.

Known limitation: the daemon's Multica credential (a personal access token for the operator account, in the `paos-worker` home) is readable by the launcher user. The Pi process is sandboxed without it, but a sandbox escape would hold operator-level Multica access. Mitigation planned: dedicated low-privilege Multica member/PAT before real-data go-live (tracked in step 26 review).

## Authority and references

Implementation sequence: `plans/paos-tiered-implementation.md`. Original whitepaper/runbook remain historical design inputs until reconciled; their GPU privacy route and larger default allocations do not override these decisions.
