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

## Authority and references

Implementation sequence: `plans/paos-tiered-implementation.md`. Original whitepaper/runbook remain historical design inputs until reconciled; their GPU privacy route and larger default allocations do not override these decisions.
