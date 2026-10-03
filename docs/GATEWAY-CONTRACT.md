# PAOS gateway and tool ownership

## Decision

**Pi owns the agent/tool loop.** PAOS validates and dispatches each allowed tool; Bifrost owns model credentials, request routing and gateway accounting. Bifrost must not run a second autonomous loop. Multica only coordinates and reports.

For the first vertical slice, implement only three scoped tool capabilities: public search, public fetch, and write report. Prefer existing audited search/fetch utilities when compatible with required URL restrictions. Search-provider selection and any fees remain a deployment input; do not give workers the administrator's existing CLI credentials.

MCP is optional transport, not a reason to add extra servers. If selected tools use MCP, PAOS calls Bifrost's explicit execution endpoint after validation, counts the call, and supplies its result back to Pi exactly once. Otherwise local Pi tools execute directly under the same policy. No blanket filesystem/shell MCP is required.

## Bifrost v2.2.5 configuration contract

| Area | Required configuration / enforcement |
|---|---|
| Provider | One custom OpenAI-compatible provider named `zen`; configured upstream resolves exactly to Zen `/zen/v1/chat/completions`; verify URL joining with a mock upstream |
| Request types | Explicitly enable only `chat_completion` and `chat_completion_stream`; other APIs denied |
| Alias | Static key alias `research` → `minimax-m2.7`; client gateway model selector `zen/research`; verify selector and pricing resolution with pinned transport |
| Credentials | Zen key exists only at gateway. Worker receives scoped `sk-bf-…` virtual key via documented Bearer auth; no administrator credential |
| Authorization | Enforce inference authentication and governance; allow only `zen`, explicit key ID and approved alias/model. No `allow_all_providers`, wildcard models/keys, anonymous inference or fallback routes |
| Admin isolation | Worker-facing network path exposes inference/approved tool APIs only, never `/api` administration or setup UI; direct gateway/admin listener must not be reachable by worker |
| MCP | No clients unless needed. Explicit tool allowlists; every client's Allow by Default disabled; `tools_to_auto_execute: []`; no Agent Mode/code-mode loop |
| Retries | One owner at PAOS/Pi policy layer, maximum two transient retries/request. Set gateway/provider retry count zero; verify actual request count |
| Accounting | Preserve requested alias, resolved model/provider and usage. Configure validated model price; unknown usage/price retains reservation or holds subsequent work |
| Budget | Approved $0.50/run plus $20/month total; UTC calendar month for local accounting. Gateway and Zen limits are defense in depth, not substitutes for pre-request reservation |

Source-reviewed features are documented in the OSS transport release: custom providers, static aliases, virtual keys, budget governance, explicit MCP execution and tool allowlists. No enterprise-only virtual-MCP/RBAC feature is required. Confirm these controls function in the pinned OSS image before real credentials or paid tests; documentation is not runtime verification.

## Required mock and live tests

1. Missing/invalid/inactive worker key rejected; worker key cannot call admin API or change provider/model.
2. `zen/research` resolves to exact Zen model and request URL; unknown alias, direct alternate model and client-supplied fallback are rejected.
3. Streaming completion includes tool-call arguments and final usage; Pi sends one correlated tool result and completes a second model turn.
4. MCP call, if used, executes once only after PAOS approval; caller headers cannot widen virtual-key tool scope. Empty auto-execution list produces no gateway-side autonomous calls.
5. Upstream timeout/429/5xx produces bounded retries, no duplicated layered retries; cancelled/ambiguous charge retains budget reservation.
6. Provider disabled/unavailable, unknown price, exhausted budget or failed authorization stops work; no alternate provider path.

No live calls performed yet. Start with synthetic public content and a mock upstream; live checks need configured spend controls and operator-provided credentials through a secure channel.

## Version-sensitive breadcrumbs

All Bifrost links below are pinned to `transports/v2.2.5`:

- [Custom providers and request-type restrictions](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/providers/custom-providers.mdx).
- [Static aliases and resolved routing metadata](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/providers/aliasing-models.mdx).
- [Virtual keys/authentication](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/features/governance/virtual-keys.mdx); [budget semantics](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/features/governance/budget-and-limits.mdx).
- [MCP allowlists and Allow by Default exception](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/features/governance/mcp-tools.mdx).
- [MCP connection/auto-execution configuration](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/mcp/connecting-to-servers.mdx); [explicit tool execution](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/mcp/tool-execution.mdx).
- [Zen endpoint, billing, reload and privacy](https://opencode.ai/docs/zen/); `docs/COMPATIBILITY.md`; `docs/RUNTIME-CONTRACT.md`.

Some pinned documentation uses older auth field names. Validate current config schema/source and negative auth tests before deployment; never resolve contradictory docs by disabling authentication.
