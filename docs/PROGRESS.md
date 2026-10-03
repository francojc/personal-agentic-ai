# PAOS implementation progress

> **Execution paused – operator-led reset.** Start with [hands-on setup workbook](HANDS-ON-LAB.md). Below is prior implementation snapshot; next-action lists are backlog, not instructions to deploy. No guest state reverified or changed during documentation reset.

**Updated:** 2026-10-03 · **Plan:** [`plans/paos-tiered-implementation.md`](../plans/paos-tiered-implementation.md) · **Completed:** 14/31 steps · **Active:** step 15 · **Deployment:** prototype/test mode only; not for real tasks.

## Current state

- New Debian 13 guest VM 103 `paos-control`; 4 vCPU, 8 GiB RAM, 96 GiB disk; existing Mac/OrbStack stack untouched.
- Multica 0.6.1, Bifrost OSS 2.2.5, Pi 1.0.1 worker, tailnet-only Serve and per-uid egress policy installed. Two independent Compose projects.
- One `Research Scout` agent and `PAOS` workspace. Only explicitly `public`-labelled issues pass policy. Private/unknown hold.
- Bubblewrap worker tools: public search (currently unavailable without backend key), public fetch, write report. No general shell/read tools.
- **Mock is running.** `paos-mock-zen` is a test container; Bifrost config currently points `zen` provider to that mock with private-network access enabled in `tests/mock/bifrost.config.json`. `/srv/paos/secrets/paos.env` currently contains a **fake** provider key; real Zen key has not been supplied/configured. No real provider inference or paid calls authorized/performed.
- Runtime logs/ledger under `/var/lib/paos` contain synthetic test data. Do not interpret those totals as real spend. The ledger has duplicate `interrupted` entries from testing before reconciliation became idempotent; archive/reset synthetic ledger before go-live.
- Operator data/privacy decisions: sensitive data must stay home; no GPU VPS for private inference. Approved limits: 1 run, 15 min, 30 tools, 2 retries, $0.50/run, $20/month. Encrypted off-host backup destination, retention and secret escrow remain undecided; real-data go-live blocked.

## Verification completed

| Plan steps | Evidence |
|---|---|
| 1–5 | Host inventory and explicit operator decisions in `docs/DEPLOYMENT.md`; integration pins/contracts in `docs/COMPATIBILITY.md`, `docs/RUNTIME-CONTRACT.md`, `docs/GATEWAY-CONTRACT.md` |
| 6–9 | VM, services and tailnet HTTPS deployed and reachable; database unpublished; LAN probes closed except SSH |
| 10–13 | Public/private/unknown issue-label policy; mid-run private-label test held task; gate blocks tools and sanitizes model requests |
| 14 | Tool cap, run budget, transient retry cap/exhaustion, deadline, hard cancellation, concurrency 1, interruption reconciliation exercised with mock |
| Tests | 42 runtime unit tests pass locally as of this update. Guest runtime currently has an earlier 37-test snapshot; redeploy latest code and rerun full suite before marking step 16. |
| End-to-end | Mock issue exercised launcher → bwrap Pi → filtered Bifrost → mock model → tools → report; tool events visible in Multica. Web search currently reports missing backend; mock ignored that tool error, so research quality is **not** established. |

## Active work: step 15 – audit records and cost reconciliation

Implemented locally but **not complete/fully deployed**:

- PAOS JSONL captures `run_id`, task/agent, sensitivity, policy version, config SHA-256, configured component versions, trusted daemon-marker issue ID, model, turns/tools, token usage, Pi-estimated cost, duration, artifact path/hash and status. Cost source remains explicit; Bifrost-reported and provider-actual fields remain null until reconciled.
- Local base and mock Bifrost configs now define exact `zen` / `minimax-m2.7` / `chat_completion` pricing (input `$0.30/M`, output `$1.20/M`, cache-read `$0.06/M`). **Runtime cost and VK-budget behavior are not yet verified.** Guest still runs mock mode; its currently loaded Bifrost config may predate this change. `$20` VK budget remains untrusted until mock verification passes.

Next, in order:

1. Deploy pricing override to the mock-only guest configuration and run synthetic requests. Verify `/api/logs?limit=...` returns nonzero `logs[].cost` and expected `token_usage`; with a deliberately tiny VK budget, prove next request is rejected. Never enable live provider while test URL/fake key remain.
2. Deploy metadata and cost-report changes; test each run records config SHA-256, configured component versions, policy version and issue ID from trusted daemon marker. `scripts/paos-cost-report.mjs` correlates VK/provider/model/timestamp-window rows and reports separate Pi/Bifrost costs and delta; ambiguous/missing usage/prices remain explicit. Human acceptance stays `not reviewed` pending Multica timeline inspection. Secrets and prompt/tool payloads stay out.
3. Test reconciliation with mock Bifrost log rows, including multi-request runs and deliberately ambiguous timestamps; add Multica issue timeline/actor lookup before asserting human acceptance. Then deploy and test only against the mock; leave step 15 open until price, budget, metadata and per-run reconciliation all verify.

## Operator inputs still needed

- Search backend: Brave Search API key (best low-complexity fit) or explicit alternative. Do not paste key into chat; provision via a secure local process to `/etc/paos/search.key` (0640 `root:paos-worker`). Until then, no general search; do not claim a useful research workflow.
- Zen credential and workspace spend controls: before any real request, disable auto-reload, set `$20` monthly cap, verify per-run budget/price enforcement, and inject key securely to Bifrost only.
- Backup destination/retention and recovery secret escrow; must be independent and encrypted before real-data go-live.
- Tailnet key-expiry/ACL review; optional disabling of key expiry is an operator decision.

## Test-mode exit procedure – do not skip

Only after mock-based step 15/16 testing is complete:

1. On guest, restore the pre-test secret file: `sudo cp /srv/paos/secrets/paos.env.pretest /srv/paos/secrets/paos.env && sudo chmod 600 /srv/paos/secrets/paos.env`.
2. Recreate base PAOS config **without** `PAOS_EXTRA_COMPOSE`: `cd /srv/paos/repo && ./scripts/paos.sh up paos`.
3. Confirm Bifrost config has production `https://opencode.ai/zen` base URL and `allow_private_network` absent/false. Confirm worker key auth and provider status without making inference calls.
4. Only then stop/remove `paos-mock-zen`. Keep provider key empty until operator has set Zen billing caps and supplied it securely. Never use `PAOS_EXTRA_COMPOSE=tests/compose.mock.yaml` outside synthetic testing.
5. Leave legacy Mac/OrbStack stack and its data untouched. No cutover, volume deletion or source cleanup before explicit recovery/cutover gate.

## Later sequence

- **16:** full verification; fix failures before proceeding.
- **17–18:** choose independent encrypted backup target, automate DB/Bifrost/config/artifact/secret recovery, restore into isolated target; real-data remains blocked until restore proves good.
- **19–20:** only then remove/replace legacy code and workshop docs, keeping legacy data untouched absent explicit migration approval; reconcile whitepaper/runbook with this measured v0.1.
- **21–23:** pin digests (including floating `pgvector:pg17`, `node:22-alpine` test image), operational restart/cold boot, storage/host capacity and security verification.
- **24:** real-model research quality/cost and citations require explicit search + Zen credentials and budget approval; acceptance needs a human action.
- **25–29:** security, failure, network, resource and operational checks.
- **30–31:** encrypted restore test and final stale-reference audit.

Detailed sources and implementation breadcrumbs: `docs/COMPATIBILITY.md`, `docs/GATEWAY-CONTRACT.md`, `docs/RUNTIME-CONTRACT.md`, and `docs/DEPLOYMENT.md`.
