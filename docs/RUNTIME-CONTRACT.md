# PAOS runtime contract – v0.1

## Scope

Native Multica Pi backend launches a trusted PAOS wrapper around pinned Pi JSON/print mode. Multica owns dispatch and user-visible run history; PAOS owns policy, scope, limits and execution outcome. No additional queue, RPC bridge or model-driven authorization.

## Trusted launch record

Before any inference, wrapper assembles and validates this record from deployment configuration plus authenticated task metadata. Prompt text, retrieved pages, model output and arbitrary environment overrides cannot grant permissions. Missing metadata holds the task; no public default.

| Field | Contract |
|---|---|
| `schema_version` | `1`; reject unsupported versions |
| `run_id` | PAOS UUID per execution attempt; correlate with Multica task ID and attempt identity |
| `multica_task_id`, `project_id` | Authenticated dispatch context; never inferred from prompt text |
| `sensitivity` | `public`, `private`, `unknown`; only explicit human-classified `public` executes in v0.1 |
| `policy_version` | Immutable policy/configuration hash |
| `model` | Fixed approved alias resolved to `minimax-m2.7` through Bifrost; reject other selectors |
| `tool_scope` | Fixed public search/fetch and run-scoped report writes; no general shell, private readers, sending or admin actions |
| `workspace` | Validated current-run directory; no symlinks/path escapes or mounts exposing other runs |
| `limits` | One active execution, 900 seconds, 30 tool calls, two transient retries/request, $0.50/run and shared monthly budget |
| `request` | Untrusted task text; size-limited; no credentials or implicitly attached private files |
| `created_at`, `deadline` | UTC timestamps plus monotonic local elapsed-time enforcement |

Use documented `MULTICA_TASK_ID`, `MULTICA_AGENT_ID`, `MULTICA_WORKSPACE_ID`, `MULTICA_SERVER_URL`, and task-scoped `MULTICA_TOKEN` only at trusted orchestration boundary. Validate against pinned daemon/API before relying on them. Do not copy credentials into launch records, prompts, tool environments or logs. Labels/project metadata retrieval API and authentication still need contract testing on pinned Multica.

## Lifecycle ownership

| State / transition | Owner and rule |
|---|---|
| Queued → claimed | Multica daemon only; concurrency configured to one at daemon and agent layers |
| Claimed → validating | PAOS wrapper acquires single-worker lease and validates trusted record |
| Validating → held | Missing metadata, private/unknown sensitivity, unapproved model/tool/budget, or unavailable required service; zero inference |
| Validating → running | All policy gates pass; reserve request budget before dispatch |
| Running → awaiting approval | A scope-changing request cannot execute. v0.1 ends current process with a clear hold report; human creates/reclassifies a new attempt after review |
| Running → succeeded | Pi is settled, terminal assistant outcome successful, process finished, cited artifact validated and outcome durably recorded |
| Running → failed / timed out / cancelled | Wrapper aborts process tree, waits bounded grace, records reason and reconciles incurred/reserved spend |
| Restart with nonterminal record | Mark interrupted/awaiting review; no automatic inference replay, duplicate artifact publication or renewed budget |

PAOS state vocabulary is not assumed to be native Multica API statuses. Map supported daemon success/error/cancel outcomes plus a structured issue/run report after checking pinned APIs. A held task must never be presented as successfully completed research.

## Progress/result envelope

Internal metadata events contain `schema_version`, `run_id`, `seq`, `time`, `type`, and bounded payload. Types: `policy_decision`, `started`, `progress`, `tool_result`, `usage`, `held`, `awaiting_approval`, `completed`, `failed`, `cancelled`, `interrupted`. Sequence is monotonic per run; terminal events are idempotent. Raw provider prompts/responses, credentials and full fetched pages are excluded from metadata logs.

Continue passing Pi's native JSONL event stream to Multica; do not inject these internal records into that stream. Stdout remains protocol-only; bounded diagnostics go to stderr. Observe definitive error/abort stop reasons as well as process exit, and do not treat `agent_end` as final settlement.

Terminal record includes status/reason, artifact relative path and checksum if present, citation count, model/provider resolution, usage/cost with estimate-versus-reported provenance, elapsed time, tool count and retries. Write artifact to temporary path then atomically publish within run workspace; do not overwrite another run's output.

## Cancellation, retry and budget semantics

- Multica cancellation and wrapper deadline both terminate the child process tree; no orphan tool processes. Wrapper cancellation is not proof that an upstream request was unbilled.
- Choose one inference retry owner. Disable retries in other layers so two retries do not multiply into repeated billable requests. Unknown charge after disconnect stays conservatively reserved until reconciliation.
- Reserve worst-case permitted request cost before sending; output/context bounds must fit remaining run/month budget. Missing prices or unbounded output holds rather than guessing.
- All auxiliary inference, compaction and automatic recovery count toward limits; disable unneeded helpers. Tool fees also need authorization and accounting before enabling a paid search service.
- Every new source/attachment/tool result passes scope/sensitivity gate before any subsequent outbound request. Private discovery tightens state to held; no automatic downgrade or provider fallback.
- Consequential actions remain disabled in v0.1. Privacy and action-permission checks are independent; no branch skips either check.

## Required contract tests

Mocked stdin/JSONL execution: success, assistant error with exit zero, retry then success, cancellation, stalled child, malformed events, missing trusted classification, duplicate dispatch, resume of interrupted session, model override attempt, workspace escape, request-budget exhaustion and unknown charge reconciliation. Native stream adapter and launcher restrictions must be tested before real credentials are configured.

References: `docs/COMPATIBILITY.md`, `docs/DEPLOYMENT.md`, pinned Multica `server/pkg/agent/pi.go`, and Pi `docs/cli-integration.md` / `docs/json.md`.
