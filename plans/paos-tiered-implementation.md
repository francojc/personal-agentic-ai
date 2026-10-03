# Personal Agentic OS – tiered implementation plan

## Context

Implement findings from the review of `plans/personal_agentic_os_whitepaper.md` and `plans/personal_agentic_os_runbook.md`. Target: useful, bounded personal workflows inside a personal Tailnet, not a miniature cloud platform. This plan governs implementation sequencing; older documents remain conceptual references until reconciled.

## Approach

Use one minimal Debian 13 VM (no desktop) on Proxmox, host-level Tailscale inside the guest, independently managed PAOS and vendor Multica Compose projects, and one restricted worker. First workflow, confirmed by operator: public research → cited report. Replace the old stack wholesale, including obsolete code and documentation; preserve recovery exports until explicit data-deletion approval. Prove the workflow before adding classifiers, vector memory, dashboards, or GPU inference. Private/unknown tasks hold until an approved route exists.

## Current host and deployment discovery

Observed authoring host: macOS 27.2, arm64, 24 GiB RAM, 8 logical CPUs, approximately 80 GiB available on checkout filesystem. Docker CLI resolves through OrbStack; Compose reports v5.1.2; Tailscale CLI reports 1.102.4. Docker daemon is unavailable at its configured OrbStack socket, so no local container validation is currently possible. Tailnet login/connectivity remains unverified.

Authorized read-only `ssh proxmox` inspection on 2026-10-03 found Proxmox VE 9.2.20, x86_64 Ryzen 7 7735HS (8 cores / 16 threads), approximately 60 GiB usable RAM, 36 GiB currently available, and low instantaneous load.

Configured guest RAM totals 44 GiB; configured CPU counts total 27 across guests (shared/overcommitted, not reserved cores). Adding 8 GiB leaves approximately 8.6 GiB outside configured guest memory for host/kernel/virtualization overhead. Last-week RRD averages across 336 samples show CPU mean 4.4%, maximum 13.6%; RAM maximum approximately 26.7 GiB; swap reached approximately 7.9/8 GiB. Two current one-second paging samples show zero swap-in/out. RRD values are interval averages, not burst peaks; investigate historical swap pressure before increasing beyond 8 GiB.

NVMe-backed `local-lvm` has a 794 GiB thin pool, 27.82% data / 1.14% metadata used (approximately 573 GiB physical data space remaining). Two VMs and six LXCs are running. Host-attached backup disks exist but do not establish an independent off-host recovery copy. No host state changed.

## Execution decisions

Operator approved new Debian 13 guest allocation above, OpenCode Zen ($20/month total; $0.50/run), one active run, 15-minute deadline, 30 tool calls, and two transient retries per request. Sensitive data must remain home-local: deferred GPU VPS cannot serve private tasks. Fresh PAOS state; preserve all legacy runtime data. Backup/network/admin decisions remain blocked until deployment gate. See `docs/DEPLOYMENT.md`.

## Reuse

- `compose.yaml`: reuse Bifrost persistence and loopback binding patterns, not the old deployment topology.
- `compose.dev.yaml`: reuse `no-new-privileges`, dropped capabilities, PID/CPU/memory limits as patterns; old devbox/Open Terminal/mcpo services are out of scope.
- `scripts/setup.sh`: prerequisites and protected environment-file pattern; do not invoke for new deployment.
- `scripts/doctor.sh`: diagnostic shape; replace weak running-container check with service-specific readiness.
- `scripts/update.sh`: do not reuse wholesale; broad pulls and automatic pruning violate targeted upgrades/rollback.

## Handoff protocol after cloning

> [!IMPORTANT]
> Start with Tier 0 only. This document authorizes planning, not infrastructure changes. Read repository instructions and this plan, recover facts without modifying hosts, then present the allocation and unresolved decisions for approval. Do not run the existing setup/update scripts. Never print `.env`, credentials, full container environments, or raw Tailnet configuration into reports.

Clone into the Debian 13 guest at `/srv/paos/repo` once provisioned. A checkout on Proxmox may support read-only inventory, but never install Docker or run workloads on the hypervisor. Operator authorized `ssh proxmox` for read-only inventory from this workstation; recheck SSH availability after cloning. Do not assume access to other machines; ask for authorized SSH targets or operator-provided inventory.

Create local, gitignored `discovery.local.md` containing sanitized evidence, timestamp, source host/command, unresolved questions, and proposed allocations. Put only non-sensitive approved decisions in `docs/DEPLOYMENT.md`. Recheck facts on the target; workstation observations above are not resource commitments.

### Required discovery and operator answers

| Area | Agent recovers read-only | Operator must decide / blocking gate |
|---|---|---|
| Execution host | `uname -sm`, `/etc/os-release`, `systemd-detect-virt`; `id` and available CLI versions | Confirm guest versus hypervisor and authorized admin access; block installations until confirmed |
| Proxmox capacity | Recheck `ssh proxmox`: `pveversion`, `pvesm status`, filtered `qm/pct config` resource fields, `vmstat`, and node `rrddata` week summary; baseline above | Approve 8 GiB allocation and at least 8 GiB host reserve; identify workloads to protect and investigate historical swap pressure; block VM allocation |
| Guest resources | `lscpu`, `free -h`, `lsblk -f`, `df -hT`, `findmnt /srv`; architecture, swap, current load | Approve allocation after accounting for host reserve and thin-provisioning capacity; no guessing from instantaneous free RAM |
| Docker/storage | Docker/Compose versions, daemon readiness, Docker data root, mounts, project/volume names, occupied ports via `ss -lnt` | New disk versus existing filesystem; protect Docker data and database volumes, not just `/srv`; approve cutover |
| Tailnet | Local device status, approved server identity, DNS and endpoint reachability; inspect effective grants only with authorized access | Admin device/user, allowed destinations/ports, guest hostname and TLS approach; do not overwrite existing Tailnet policy |
| Model/provider | Pinned gateway/model compatibility, tool-call support, provider account availability without exposing keys | Provider choice, monthly total budget, per-run budget and timeout, maximum concurrency; block paid calls until set |
| Privacy/data | Existing labels, input sources, retention requirements if documented | May sensitive data leave home for a VPS? Which data is prohibited? Unknown remains hold; no real private-data tests |
| Existing state | Old volumes, configuration, workspaces, dependent clients, and recoverable exports on each authorized host; existing 8 GiB agent VM is not presumed disposable | Approve a new VM ID rather than repurposing existing guests. What must migrate: Bifrost settings, chat history, files, or nothing? Wholesale code replacement does not authorize data destruction |
| Recovery | Available backup destination, capacity, encryption support, restore tooling | Backup target, retention, acceptable downtime/data loss, secret escrow; block real-data go-live without restore path |

If a tool or permission is absent, record unknown and ask; do not install discovery tools or escalate privileges automatically. Do not infer Proxmox headroom from a guest. Ask for a representative utilization window where no metrics exist.

### Provisional resource envelope, not a reservation

| Tier | Starting hypothesis | Allocate / resize only after |
|---|---|---|
| v0.1 without local inference | New Debian 13 amd64 minimal VM: 4 vCPU, 8 GiB RAM, one active worker, 96 GiB NVMe-backed virtual disk on `local-lvm` | Operator approves resource reserve, new VM identity and existing workload impact; any RAM increase requires reducing other allocations or reassessing host capacity |
| Storage layout | One 96 GiB guest filesystem for OS, `/srv/paos`, Docker images and named volumes; simplest v0.1 layout | Confirm backup inclusion, thin-pool headroom and growth budget; separate data disk only if justified; avoid 32 GiB root with unbounded Docker data |
| Local classifier | No allocation in v0.1 | Benchmark exact model/quantization/context on target CPU; count concurrent worker + database + model peak memory |
| Private inference | No GPU purchase or VPS reservation | Approve privacy boundary/budget and benchmark exact model, quantization, context and tool reliability; size VRAM including KV cache |

Use VirtIO devices and guest agent support; install only needed Debian packages, not a desktop. Do not treat an 8 GiB balloon maximum as additional free host memory. Set worker CPU/RAM/PID limits, log rotation, run timeout and disk alert threshold. Leave roughly 25% guest RAM headroom during representative peak tests; keep a separate operator-approved hypervisor reserve. Measure before increasing vCPU or adding services.

## Steps – tiered delivery

### Tier 0 – discover, resolve compatibility, approve allocation

- [x] Recover the inventory and operator answers above. Record budget/privacy unknowns as explicit blockers, not permissive defaults. Approved decisions: `docs/DEPLOYMENT.md`; local evidence: gitignored `discovery.local.md`.
- [x] Pin candidate Multica, Pi, Bifrost and model versions. Verify Multica’s supported runtime protocol against Pi; custom command registration alone is not proof of compatibility. Inspect pinned docs/source before choosing adapter transport. [D1–D3] Source review and candidate pins: `docs/COMPATIBILITY.md`. Native Pi JSON backend confirmed; live interoperability remains a deployment acceptance test.
- [x] Define a small integration contract: `run_id`, project, explicit sensitivity, selected model, tool scope, limits, progress/result/error, cancel, and awaiting-approval state. One owner for each transition; Multica owns dispatch, worker adapter owns execution and policy enforcement. See `docs/RUNTIME-CONTRACT.md`; implementation/contract tests remain pending.
- [x] Define who executes tools: Pi adapter does; Bifrost supplies inference and scoped MCP access where verified. Disable duplicate gateway auto-execution. Check alias/auth/streaming/tool behavior for the selected provider, including feature availability in the pinned edition. [D3] Source-reviewed contract: `docs/GATEWAY-CONTRACT.md`; actual configuration and mock/live enforcement tests remain required in implementation.
- [x] Inventory old-state recovery requirements; propose resource allocation and rollback. Get approval before provisioning, paid tests, or cutover. Operator authorized new VM on vmbr0/DHCP using current SSH public key; Mac/OrbStack legacy state remains untouched. Paid calls/cutover/recovery gates remain documented in `docs/DEPLOYMENT.md`.

**Exit:** supported integration path identified, resource/budget proposal approved, unresolved requirements scoped to blocked later tiers. If a minimal adapter is not feasible, stop for a design decision; do not silently substitute a different runtime.

### Tier 1 – smallest end-to-end v0.1 workflow

- [x] Provision the approved minimal Debian 13 VM (done 2026-10-03: VM 103; see `docs/DEPLOYMENT.md`, `scripts/provision-guest.sh`); verify Debian 13 support in pinned Docker/Tailscale installation docs rather than reusing Ubuntu repository commands. Install guest-level Tailscale and Docker; no application changes to Proxmox host. Separate deployment administrator from worker identity. Worker gets no sudo or Docker-group access. [D4–D5]
- [x] Use two explicit Compose projects (done: `compose.paos.yaml`, `scripts/paos.sh`): PAOS services and pinned vendor Multica. One wrapper targets both for status/start/stop/backup; never mix standalone and merged invocations. Keep vendor state/schema separate. Validate paths and resolved configuration without logging secrets. [D1, D4]
- [ ] Deploy Multica, Bifrost and one restricted worker/adapter. No separate policy daemon required: a small tested module in the adapter enforces rules. No PAOS memory database or Redis yet; use Multica run records plus local metadata-only JSONL and gateway accounting.
- [ ] Expose UI/API via guest-level Tailnet HTTPS, with tested Multica HTTP/WebSocket paths. Use one verified hostname/port layout rather than invented MagicDNS service subdomains. Databases unexposed; admin endpoints inaccessible to worker. Validate LAN/public exposure independently of UFW. [D1, D5]
- [ ] Implement manual public/private/unknown labels. Only explicit public tasks using approved public sources may invoke cloud inference. Private/unknown holds. Apply privacy and consequential-action checks independently; no early return bypasses approvals.
- [ ] Inject only per-service credentials. Worker receives a scoped gateway token and task-scoped Multica access, not provider/admin/DB secrets. Restricted mount contains only current run’s workspace; no host home, canonical repo, other runs, or Docker socket.
- [ ] Run public research → cited report using one dependable model, approved public-search/fetch tools, and workspace-scoped writes. Disable generic shell and private-file access for this role; restricted tools reject local/private-network fetch targets and redirects. Treat retrieved instructions as untrusted data, not policy. [D2–D3]
- [ ] Prevent private context ingress in this public-only worker. Gate outbound model/tool requests against sensitivity and approved scope; labels only tighten without human reclassification. Scope memory, embeddings and external search under the same policy when later introduced.
- [ ] Start with one concurrent run. Enforce approved cost/time/tool-step/retry limits and cancellation; persist terminal state. No recursive automatic escalation, no sending/purchasing/Git push/admin actions, and no automatic replay of external writes.
- [ ] Record run ID, configuration/version, model, token/cost estimates versus reported usage, status, duration, artifact path and human acceptance. Do not log full prompts or sensitive tool payloads by default.

**Exit:** one Multica issue completes through policy → Pi → Bifrost → approved tools, returns a cited report, and stays within scope and approved spend. Gateway-only success is insufficient.

### Tier 2 – qualify v0.1, replace legacy, document operations

- [ ] Complete verification below; correct failures before adding features.
- [ ] Automate encrypted off-VM backups of Multica DB, consistent Bifrost state, artifacts, pinned configuration and required secrets. Use service-supported backup or brief quiescence for Bifrost; archive listing alone is not restore validation.
- [ ] Restore onto a disposable guest/project, including encryption keys and actual records/artifacts. Document recovery order, disk-full behavior and measured recovery time. Keep secret recovery separate from Git.
- [ ] Replace legacy code/docs wholesale after recovery exports and cutover approval. Remove old services, scripts and obsolete setup paths; migrate only explicitly requested state. Stop old stack deliberately. Do not prune images, delete volumes, deregister Tailnet nodes, or erase workstation data without explicit approval.
- [ ] Reconcile whitepaper/runbook with this scope: one schema source when memory arrives, independent privacy/approval logic, consistent lifecycle commands and accurate trust boundaries. Replace workshop-first README with clone → discover → approve → deploy → verify instructions.
- [ ] Pin images/dependencies before go-live. Upgrade one service at a time with backup, migration-aware rollback and synthetic test. Test restart/cancel behavior; ambiguous runs become interrupted/awaiting review, not silently duplicated.

**Exit:** bounded research workflow is useful, reconstructible, observable without dashboards, and recoverable. This completes v0.1; later tiers are optional.

## Deferrals beyond v0.1

| Tier | Deferred capability | Trigger / prerequisite |
|---|---|---|
| 3 – continuity | Curated project notes, then PostgreSQL memory if needed | Repeated context loss demonstrated; select one canonical schema with provenance, namespaces, retention/deletion and supersession |
| 3 – retrieval | pgvector, embeddings, reranking, memory graph | Simple notes/SQL search inadequate; select embedding model/privacy route before vector dimensions; test isolation and deletion |
| 3 – routing | Local classifier in shadow mode, then automatic tiers/escalation | Labeled task sample and baseline costs; measured quality/cost benefit, calibrated thresholds; explicit labels remain authoritative |
| 3 – execution | Builder/critic roles, shell, additional MCPs | Research worker stable; independent mounts/credentials, side-effect approvals, sandbox and denial tests for each added capability |
| 4 – private inference | GPU VPS or home-local inference | Operator answers trust/budget question; benchmark workload; VPS is cloud-hosted, not home-local or confidential computing |
| 4 – operations | Redis, Prometheus/Grafana, extra networks/hosts | Existing dispatch/logs demonstrably insufficient; avoid a second queue owner and premature infrastructure split |
| Later – consequential tools | Email/calendar writes, purchases, admin automation | Explicit need, action-bound single-use approval, idempotency/reconciliation and cancellation tested; never infer permission from model confidence |

GPU private routes must have private-only provider credentials/allowlists, no public fallback, and synthetic outage tests. Highly sensitive home-only data stays held if only VPS inference exists. Infrastructure placement within a Tailnet does not change provider trust.

## Files to modify during implementation

| Paths | Planned treatment |
|---|---|
| `compose.yaml`, `.env.example`, `.gitignore` | Replace legacy topology; explicit env allowlists, resource limits and persistence; ignore discovery reports, secrets, runtime state and vendor local config |
| `scripts/setup.sh`, `scripts/doctor.sh`, `scripts/update.sh` | Rewrite for approved guest deployment, strong readiness checks, consistent two-project wrapper and targeted upgrades; no automatic prune |
| New `scripts/paos.sh`, `scripts/discover.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/smoke-test.sh` | Small lifecycle/discovery/recovery helpers; read-only discovery by default; restore requires explicit target |
| New `runtime/`, `config/paos/`, `tests/` | Minimal adapter/policy module, worker image/tool configuration, policy/contract tests; finalize language/transport after Tier 0 |
| New pinned `vendor/multica/` reference | Upstream release/commit and image versions; no copied vendor service internals or generated secrets in Git |
| `compose.dev.yaml`, `scripts/dev.sh`, `scripts/setup.ps1`, `scripts/tsdproxy-auth.sh`, `config/mcpo/` | Remove obsolete deployment paths; Linux guest is deployment target, Mac is authoring/admin client |
| `README.md`, `docs/`, both original `plans/` documents | Replace obsolete workshop/setup instructions; add `docs/DEPLOYMENT.md` and concise operations/recovery notes; retain this plan as handoff |
| `slides/`, `PAOS/`, `diagrams/`, `scratch.md` | Audit references and relevance; remove obsolete tracked material or update useful conceptual material; no stale generated HTML/PDF/slides presented as current documentation |

Git history preserves legacy source. Runtime data/volumes are separate from code removal and require explicit disposition approval. Do not touch untracked personal work merely because it sits under an obsolete directory.

## Verification

- [ ] Read-only discovery reports correct host and unknowns; no credentials or raw infrastructure identifiers committed.
- [ ] Compose validates, services pass real readiness checks, pinned images support target architecture, and cold boot brings both projects back correctly.
- [ ] Public issue produces useful cited report; citations resolve and sampled claims match sources; human acceptance recorded. Show per-run spend and total provider budget boundary.
- [ ] Private/unknown issue produces zero external inference/tool calls. A private source introduced mid-run holds before disclosure. Consequential private action cannot bypass approval logic.
- [ ] Worker cannot access another workspace, provider/admin secrets, host Docker socket, direct database/admin APIs, or disallowed tools. A malicious fetched page cannot expand capabilities or redirect fetches into private networks.
- [ ] Gateway/provider outage, timeout, cancellation, retry exhaustion and budget exhaustion end in recorded bounded states. Restart does not duplicate work; no cloud fallback for private data.
- [ ] Non-admin Tailnet access and unapproved LAN/public access fail; approved UI/WebSockets and tool/model paths work. Confirm container-published-port behavior, not merely firewall configuration.
- [ ] Representative run stays within approved CPU/RAM/disk limits; logs rotate; disk alert and backup schedule work.
- [ ] Encrypted off-host backup restores DB records, gateway config with keys, and report artifact into isolated target; restored stack passes synthetic workflow.
- [ ] Legacy-reference/link audit passes; new setup cannot accidentally launch old stack. Record tested versions, allocation, limitations, and restore date.

## Documentation breadcrumbs

Read version-matched primary docs and source before implementing non-trivial integrations. Record exact tested versions and any adapter assumptions; links describe capabilities, not proof that the chosen versions interoperate.

- **D1 – Multica:** [self-host lifecycle and reverse proxy](https://multica.ai/docs/self-host-quickstart), [daemon/runtime protocol constraints and task context](https://multica.ai/docs/daemon-runtimes), [upstream source](https://github.com/multica-ai/multica). Verify cancellation, approval states, concurrency, auth and WebSocket routes against pinned release.
- **D2 – Pi:** [upstream package/docs](https://github.com/earendil-works/pi/tree/v1.0.1/packages/coding-agent). Inspect pinned README, `docs/sdk.md`, `docs/rpc.md` and relevant examples before choosing SDK/RPC adapter; verify scoped tool registration and cancellation. Protocol adapter is not a sandbox.
- **D3 – Bifrost/provider:** [Bifrost source/docs](https://github.com/maximhq/bifrost), especially gateway setup, virtual keys, MCP tool governance, provider configuration and observability; [OpenCode Zen](https://opencode.ai/docs/zen/). Verify actual model endpoint/protocol, scoped keys, streaming, tool calls, cost reporting and fallback behavior.
- **D4 – Debian/Docker/Proxmox:** [Debian 13 installation guide](https://www.debian.org/releases/trixie/installmanual), [Docker Engine on Debian](https://docs.docker.com/engine/install/debian/), [Compose multi-file semantics](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/), [Docker firewall behavior](https://docs.docker.com/engine/network/packet-filtering-firewalls/), [daemon data directory](https://docs.docker.com/engine/daemon/), [Proxmox administration](https://pve.proxmox.com/pve-docs/pve-admin-guide.html). Two projects avoid vendor-relative-path merge surprises.
- **D5 – Tailscale:** [Grants](https://tailscale.com/docs/features/access-control/grants), [Serve](https://tailscale.com/docs/features/tailscale-serve). Reconcile with existing grants; policies are additive. Verify identity, HTTPS naming, permitted ports and no Funnel/public ingress.
- **Deferred:** [llama.cpp server/SystemOne](https://github.com/ggml-org/llama.cpp/tree/master/tools/server), [pgvector](https://github.com/pgvector/pgvector), [PostgreSQL backup](https://www.postgresql.org/docs/current/backup.html), [vLLM Docker](https://docs.vllm.ai/en/stable/deployment/docker/). Validate classifier schema and actual backup/restore compatibility against pinned versions.
