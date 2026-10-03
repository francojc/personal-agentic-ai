# PAOS deployment decisions

## Status

**Operator-led reset:** follow [hands-on setup workbook](HANDS-ON-LAB.md). Implementation queue paused; prior approvals and procedures below do not authorize assistant-led execution under new working mode. Existing VM/data preserved; no deployment changes made for reset.

Tier 0 and first prototype steps 1–14 complete; step 15 (auditable per-run records and cost reconciliation) is active. See `docs/PROGRESS.md` for current state and next actions. Guest is in **mock test mode** with a fake provider key; not ready for real tasks. No paid calls or real user data. Steps 17–18 encrypted independent backup/restore and operator search/Zen credentials remain go-live gates. Legacy Mac/OrbStack stack remains untouched.

## Approved decisions

| Item | Decision |
|---|---|
| Target | New minimal Debian 13 amd64 VM on Proxmox; no desktop |
| Allocation | 4 vCPU, 8 GiB RAM, 96 GiB NVMe-backed disk; preserve host reserve and existing guests |
| First workflow | Public research → cited report inside restricted workspace |
| Provider/budget | OpenCode Zen, candidate model `minimax-m2.7`; $20/month total, $0.50/run. Bifrost pricing override and live budget enforcement still unverified; no real key/calls |
| Execution limits | One active run, 15 minutes, 30 tool calls, two transient retries per request; retries count toward limits |
| Privacy | Sensitive data must remain home-local; private/unknown tasks hold in v0.1; GPU VPS is not an eligible private route |
| Migration | Fresh PAOS state; wholesale legacy code/documentation replacement, legacy runtime data preserved untouched |
| Deployment topology | Two explicit Compose projects: PAOS and pinned upstream Multica |

## Blocking gates

- **Before real inference:** add/check custom Bifrost pricing override for `minimax-m2.7`; prove nonzero gateway cost and `$20` VK budget enforcement with mock. Zen key is not configured for real use; if one is added, disable automatic reload and enforce workspace cap first.
- **Research quality:** choose a search backend and securely provision its key. DuckDuckGo HTML returned anti-bot challenge; Brave support is implemented but unconfigured.
- **Before real data/go-live:** choose independent encrypted backup destination, retention and secret escrow; automate and test restore (steps 17–18).
- **Before cutover:** legacy Mac/OrbStack stack is explicitly preserve-only; no shutdown/deletion authorized. Source replacement follows backup/restore and explicit approval.
- **Tailnet:** review key expiry and ACLs; do not alter existing Tailnet policy without approval.

Sanitized host inventory lives in gitignored `discovery.local.md`; no credentials or private infrastructure identifiers belong here.

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

Open items: (1) operator review of Tailnet key expiry and ACLs; (2) systemd-resolved LLMNR 5355 is UFW-blocked (optionally disable); (3) Bifrost custom-model pricing override and actual `$20` VK budget still need verification in step 15; (4) no Brave key/search backend or real Zen key; (5) mock test mode must be exited per `docs/PROGRESS.md` before production config.

## Compose topology (step 7)

Two projects, one wrapper: `scripts/paos.sh`. Never run bare `docker compose` or merge files.

| Project | Source | Notes |
|---|---|---|
| `paos` | `compose.paos.yaml` | Bifrost `v2.2.5` + gateway filter; loopback-only publish; caps dropped, memory/PID/CPU limits. Currently recreated with test-only mock config; see test-mode exit steps below |
| `multica` | `vendor/multica` at `v0.6.1` (`2ea01ae`), verified by `vendor-fetch` | Vendor compose unmodified; images tagged `v0.6.1`; its Postgres uses floating `pgvector/pgvector:pg17` – pin by digest in step 21 |

Secrets live in `/srv/paos/secrets/{paos,multica}.env` (0600, outside Git); `init-secrets` never overwrites. Commands: `vendor-fetch`, `init-secrets`, `config`, `up`, `stop`, `down` (never removes volumes), `status`, `logs`. Both projects validated and pinned runtime images publish amd64 manifests (2026-10-03). Services are running. The Multica daemon runs on the host as `paos-worker` (not in Compose), per upstream design.

## Services and worker runtime (step 8)

Running (2026-10-03): Multica `v0.6.1` (`readyz` db+migrations ok, frontend 200), Bifrost `v2.2.5` (healthy) plus loopback gateway filter, and scripted `paos-mock-zen`. Multica workspace/agent and Bifrost VK are configured. Guest is explicitly in mock test mode; see `docs/PROGRESS.md` for restoration steps.

Worker runtime (root-owned, `/opt/paos`): Node `v22.23.3`, Pi `1.0.1` (`--ignore-scripts`), Multica CLI `0.6.1` (checksum-verified), `bubblewrap 0.12.0`; installed by `scripts/install-worker-runtime.sh`. Launcher and policy code in `runtime/` installed by `scripts/install-worker-config.sh`; config `/etc/paos/worker.json` (template `config/paos/worker.json.example`); state/ledger `/var/lib/paos`.

Design as built:
- Multica daemon runs on the host as `paos-worker` (`config/paos/multica-daemon.service`, concurrency 1) with `MULTICA_PI_PATH` pointing at `runtime/paos-pi.mjs`, so Multica's native Pi backend executes our launcher, never raw `pi`.
- Launcher: validates args (rejects everything but Multica's invocation; model is forced), requires an allow-listed agent and `public` sensitivity (unresolved = HOLD, exit 3), checks the monthly ledger, takes a single-run lock, then runs Pi inside `bwrap` (cleared env, only `/work`, session file, read-only runtime/config, no `/home`, `/srv`, Docker socket or Multica token). Tools: `web_search`, `web_fetch`, `write_report` only.
- Limits enforced outside the sandbox from Pi's JSONL stream: 900 s deadline, 30 tool calls, per-run cost with a worst-case-request margin (unknown cost fails closed), cancellation via signals; success requires `agent_settled` and a non-error terminal turn.
- Metadata-only JSONL under `/var/lib/paos/runs/` and a spend ledger; no prompts or fetched pages logged.
- Unit tests: `node --test runtime/test/*.test.mjs` (42 passing locally; redeploy latest runtime and rerun on guest before step 16).

Step-8 implementation now includes live sensitivity resolution, gateway VK/filter, per-uid egress policy and mock end-to-end execution (steps 9–14). Remaining gaps are cost reconciliation, provider-backed search and human acceptance evidence.

## Access layout (step 9)

One origin: `https://paos-control.<tailnet>.ts.net` (guest-level `tailscale serve`, tailnet-only, no Funnel; `scripts/tailnet-serve.sh`). Routes: `/health`, `/ws`, `/api/daemon/ws` -> Multica backend `127.0.0.1:8080`; everything else -> frontend `127.0.0.1:3000`. Multica `.env` sets `FRONTEND_ORIGIN`, `MULTICA_APP_URL`, `MULTICA_PUBLIC_URL` to that origin and `MULTICA_TRUSTED_PROXIES=127.0.0.1/32`; `/api/config` reports the same daemon URL.

Verified 2026-10-03 from the operator workstation: `/health` 200 (commit matches pin), `/` and `/api/config` 200 with a valid certificate, `/ws` and `/api/daemon/ws` reach the backend (400/401, not the frontend). From the Proxmox LAN only SSH (22) is open; 3000/8080/8081/5432 are closed. Postgres is unpublished. Bifrost admin remains loopback-only.

Sign-in: the initial account was bootstrapped for the operator; `ALLOW_SIGNUP=false` is now set. For login, request a code and read it from backend logs via `./scripts/paos.sh logs multica backend` (no email service configured). Bifrost admin credentials are local-only in the protected secret file; worker uid cannot reach its admin listener.

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

## Credential and network isolation (step 11)

| Secret | Held by | Not available to |
|---|---|---|
| `ZEN_API_KEY` | Bifrost currently receives test-only fake key; no real Zen credential is set | worker, sandbox, Multica |
| Bifrost admin user/password, `BIFROST_ENCRYPTION_KEY` | `/srv/paos/secrets/paos.env` (0600 `paos`), Bifrost env | worker uid (file unreadable; admin port blocked) |
| Worker virtual key `PAOS_WORKER_VK` (`sk-bf-…`, model `zen/research` only; $20/month budget configured but not effective until cost override works) | `/etc/paos/gateway.key` (0640 `root:paos-worker`); passed to the sandboxed Pi as env | provider key, admin API |
| Multica task token (`MULTICA_TOKEN`) | daemon -> launcher only (label lookup); sandbox env is cleared | sandboxed Pi |
| Multica daemon PAT, DB/JWT secrets | `paos-worker` home / `multica.env` | sandbox (see known limitation) |

Gateway: Bifrost `v2.2.5` loads `config/paos/bifrost/config.json` (authoritative file; admin auth on; content logging off; custom provider `zen` = OpenAI-compatible, chat completions only, retries 0; static alias `research` -> `minimax-m2.7`; one VK). Worker reaches only `127.0.0.1:8082`, an nginx filter that proxies `POST /v1/chat/completions` and returns 404/403 for everything else. Verified: no auth 401; wrong key 401; allowed key with model `zen/other` 403 (`model_blocked`); provider `openai/*` rejected; `/api/*`, `/`, `/v1/models` 404 via the filter.

Worker egress (`scripts/worker-firewall.sh`, unit `paos-worker-firewall.service`): per-uid iptables owner rules. Allowed: DNS stub, `:8082` filter, own Tailnet HTTPS (daemon -> Multica), public web 80/443 (IPv4 and IPv6 `2000::/3`). Rejected: loopback admin ports (Bifrost 8081, Multica 8080/3000), LAN, other Tailnet peers (incl. Proxmox), link-local/metadata, Docker bridges, IPv6 ULA/loopback. Verified as `paos-worker` on the guest; admin user unaffected. The daemon, launcher and sandboxed Pi share this uid, so the policy is the union of what they need.

Fixes found: the daemon refuses to start with its working directory under the workspaces root (Multica writes a task marker there) – unit now uses `/var/lib/paos/home`.

Known limitations: (1) shared worker uid as above; (2) the Pi sandbox is `bwrap` on the same kernel, not a VM; (3) Zen key, spend limits and auto-reload still need operator action before any paid call.

## Research run (step 12) – mechanics proven against a mock, research quality pending

> [!WARNING]
> **TEST MODE currently active on the guest**: running Bifrost container uses the test-only bind mount `tests/mock/bifrost.config.json` (provider `zen` -> scripted mock `paos-mock-zen`, private-network allowed) and `/srv/paos/secrets/paos.env` holds a fake `ZEN_API_KEY` (backup: `paos.env.pretest`). No real provider is contacted. Exact reversible restoration steps are in `docs/PROGRESS.md`; do not enable real inference until pricing/budget and operator credentials are verified.

Result (2026-10-03): a `public`-labelled Multica issue ran Multica -> daemon -> `paos-pi` launcher -> bubblewrap-sandboxed Pi 1.0.1 -> filtered gateway -> Bifrost (VK auth, alias `research` -> `minimax-m2.7`) -> mock model, streaming with tool calls. Run `completed`; 4 turns, 3 tool calls (`web_search`, `web_fetch`, `write_report`); `report.md` written in the run workspace (SHA-256 logged); cost computed from Pi usage and ledgered; tool steps visible in Multica run messages.

Defects found and fixed: Pi needs a writable agent dir (`/agent` is now a per-run, secret-free temp dir bound rw); `web_search` via DuckDuckGo HTML is blocked by an anti-bot challenge (HTTP 202) from this host, so keyless search was replaced by a pluggable backend that fails loudly. **Operator decision/input needed:** choose a search provider and provision its key securely. Brave Search API is implemented (`/etc/paos/search.key`, 0640 `root:paos-worker`); alternative is self-hosted SearXNG. Until configured, `web_search` errors clearly and the model may only use known URLs with `web_fetch`; do not claim general web research works.

Not yet proven (tracked in steps 15, 24–27): Bifrost reports zero cost for custom `zen/minimax-m2.7`; the `$20` gateway VK budget is ineffective until a custom pricing override is added and tested. The PAOS ledger uses Pi's configured local estimate. Real Zen tool-call reliability/citation quality and a real-search backend remain untested. Final reply is configured to include report, but latest deployed prompt/version still needs verification.

## Private-context ingress control (step 13)

The worker is public-only by construction, and the check is continuous, not just at launch:

1. **No private inputs exist for it.** The sandbox has no generic read/shell tools, no host files, no memory/embedding stores; the only inputs are the labelled issue text and public web content.
2. **Sensitivity gate** (`runtime/gate.mjs`): while a run is active the launcher re-resolves the issue labels every 3 s (and at every `turn_end`) and publishes the verdict to `/gate/state` (read-only mount). Any non-public verdict (a `private` label added, `public` removed, marker/agent mismatch) is terminal: the launcher records `held` (exit 3) and kills the run. Labels only tighten; a run cannot be revived by re-adding `public`. Lookup *errors* are tolerated for up to 3 consecutive checks but outbound activity is blocked meanwhile.
3. **Fail-closed in the sandbox** (`runtime/extensions/paos-research.mjs`): every tool call is blocked unless `/gate/state` reads exactly `public` (missing/garbled = closed), and `before_provider_request` replaces the whole payload with a single placeholder message and no tools, so nothing from the conversation can reach the provider after the gate closes.
4. **Tool allow-list** is enforced twice (`--tools` and the extension); URL fetches are public-only (connect-time address filter plus per-uid firewall).

Verified live: a run labelled `public` was stopped within seconds after `private` was added (ledger `held`, exit 3, no later model request); with the gate pre-closed the model endpoint received one sanitized message, no tools and none of the task text. Latest local suite: 42 passing (policy, net, monitor, sensitivity, lock, gate, extension, reconciliation); guest has an earlier runtime snapshot and must be refreshed/retested in step 16.

Residual risk (accepted for v0.1): a model request already in flight, or started within one poll interval (<=3 s) of a label change, was authorised when sent and cannot be recalled. Hard-real-time guarantees would need the launcher in the request path (e.g. gateway-side check), deferred to Tier 3.

Memory, embeddings and external search added later must pass through this same gate and sensitivity labelling before they are enabled for the worker.

## Execution limits (step 14) – verified live against the mock

| Limit (approved) | Enforced by | Live result |
|---|---|---|
| One active run | daemon `MULTICA_DAEMON_MAX_CONCURRENT_TASKS=1`, agent max 1, launcher lock | second/third issue stayed `queued` until the running one finished |
| 15 min deadline | launcher timer (SIGTERM then SIGKILL) | deadline set to 15 s for the test: killed at 15 s, `failed`, reason recorded, cost logged |
| 30 tool calls | launcher monitor (kill) + in-sandbox extension (blocks call 31) | loop mock stopped at the limit; `tool-call limit (30) exceeded` |
| $0.50/run | launcher `RunBudget` from Pi's locally configured usage estimate (worst-case-request margin $0.03; unknown cost fails closed) | costly mock killed after 2 turns; Bifrost custom-provider cost was zero in logs, so gateway VK budget is not yet enforceable until step 15 pricing reconciliation |
| 2 transient retries/request | Pi `retry.maxRetries=2`, `provider.maxRetries=0`, Bifrost `max_retries=0` (single owner) | 2 injected 503s: recovered (run completed, 6 upstream requests incl. failures); 3 injected 503s: failed after exactly 3 attempts |
| No hidden model traffic | Pi settings pinned per run: compaction off, cache-warming off, telemetry off | – |
| Cancellation | Multica cancel hard-kills the launcher (no signal handler can run); `bwrap --die-with-parent` takes the sandbox down | status `cancelled`; no leftover processes. The next launch reconciles: the killed run is ledgered `interrupted` at last logged cost + one worst-case request, and stale `agent-*`/`gate-*` dirs and locks are cleared (`runtime/reconcile.mjs`) |
| No automatic replay | no external-write tools exist; Multica did not auto-retry any failed/held/limit-killed run (1 run each) | – |

Per-turn `usage` events (cumulative cost) are logged so accounting survives a hard kill. Defects found and fixed: reconciliation is idempotent (`interrupted` terminal), cancellation leaves no active processes, stale dirs/locks are cleaned on next launch, and `web_fetch` output is capped at 12k chars. Synthetic test history in `/var/lib/paos` must be archived/reset before real usage.

Escalation: there is none. A failed run stays failed; a human re-runs it. Sending, purchasing, pushing and admin actions are not implemented for this worker.

Housekeeping: the test ledger/logs in `/var/lib/paos` contain synthetic runs; reset them (move aside) before real use so the monthly allowance starts clean.

## Step 15 – next auditability work

`docs/PROGRESS.md` contains handoff checklist. Critical gap found: Bifrost logs `cost: 0` for the custom Zen provider, so its configured VK budget currently cannot enforce spend. Repository configs now contain pinned custom pricing for `minimax-m2.7` (input `$0.30/M`, output `$1.20/M`, cache-read `$0.06/M`), but guest deployment, nonzero mock log cost and deliberate VK budget-rejection test remain outstanding; do not treat `$20` budget as reliable. Local PAOS changes add config hash/version and trusted issue ID; `scripts/paos-cost-report.mjs` compares Pi estimates against Bifrost logs by VK/provider/model/time window. Deploy and test against mock only. Leave provider actual `unknown` until account usage is available. Human acceptance remains `not reviewed` until issue timeline confirms human actor.

## Authority and references

Implementation sequence: `plans/paos-tiered-implementation.md`. Original whitepaper/runbook remain historical design inputs until reconciled; their GPU privacy route and larger default allocations do not override these decisions.
