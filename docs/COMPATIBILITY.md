# PAOS compatibility baseline

## Candidate pins – inspected 2026-10-03

These are source-reviewed candidates, not a claim of successful deployment. Resolve image digests/architecture manifests and package lockfiles before build; run synthetic integration tests before go-live.

| Component | Candidate | Evidence / outstanding check |
|---|---|---|
| Multica | `v0.6.1`, commit `2ea01ae4ef55de4310b99af192d2dbd367832883` | Native Pi backend present; pin both daemon and server images to matching release |
| Pi | `@earendil-works/pi-coding-agent@1.0.1`; upstream `v1.0.1`, commit `a7229ddc21810d6245105978033b7df645ecc2f7` | Installed package/docs inspected; upstream is now `earendil-works/pi`, not old `badlogic/pi-mono`; requires Node >=22.19 |
| Bifrost OSS gateway | `maximhq/bifrost:v2.2.5`, source tag `transports/v2.2.5` | Official transport release names this image; GitHub `releases/latest` instead points to enterprise base tag and is unsuitable for selecting OSS image |
| Zen model | `minimax-m2.7` | Candidate public-research baseline; documented Chat Completions endpoint, $0.30/M input, $1.20/M output, $0.06/M cached reads; quality/tool round-trip still untested |
| Model endpoint | `https://opencode.ai/zen/v1/chat/completions` | Pin model ID, not a moving cheapest-model alias; hosted weights/backend revisions cannot be frozen by this repository |

## Runtime transport decision

Use Multica's native **Pi JSON/print-mode backend**, not a new SDK-to-Multica or RPC bridge. In pinned `server/pkg/agent/pi.go`, Multica launches `pi -p --mode json --session <path>`, supplies prompt through stdin and closes it, parses streamed text/tool/usage events, and owns process cancellation. The model selector passes through `--model` without guessing a provider prefix.

Pi 1.0.1 documents matching JSONL records: `message_update.assistantMessageEvent`, `tool_execution_start/end`, and `turn_end.message.usage`. Final failure must be inferred from event stop reasons plus process outcome; JSON mode can exit zero after an assistant error. Automatic retries mean `agent_end` alone is not completion. Contract tests must cover this and process cancellation/resume before claiming interoperability.

Keep a small PAOS launch wrapper/policy layer around the real pinned Pi executable, with fixed isolated resource configuration and controlled tool implementations. Do not fork Multica or emulate its backend protocol. RPC/SDK remain available internally only if justified later.

### Important hardening discovery

Multica's `piBlockedArgs` rejects `--tools`, `--no-tools`, `--exclude-tools`, `--extension`, and other sensitive flags in per-agent custom arguments. Nearby comments suggest custom arguments can restrict tools, but the executable filtering code contradicts that comment. Therefore **UI custom arguments cannot be our capability boundary**. Enforce fixed tools/resource paths in a trusted wrapper and isolated Pi configuration; verify deny tests and model-lock behavior. Do not assume a working directory restricts built-in filesystem/shell tools.

No paid calls, dependency installations, or runtime changes were performed during this source review. Live streaming/tool round-trip, CLI probing, resource loading, cancellation, and image architecture checks remain required.

## Budget caveat

Zen documents automatic $20 reload below $5 balance. Disable auto-reload before pilot use and configure workspace/member usage limits. Payment processing fees mean $20 usage is not $20 cash outlay; preserve the approved total budget by reserving fees rather than silently exceeding it. Per-run cap needs conservative pre-request reservation and bounded output, not only post-response accounting. Recheck prices and model availability before paid tests; never auto-switch a missing model.

## Breadcrumbs

- [Multica release](https://github.com/multica-ai/multica/releases/tag/v0.6.1), [native Pi backend](https://github.com/multica-ai/multica/blob/v0.6.1/server/pkg/agent/pi.go), [Pi backend tests](https://github.com/multica-ai/multica/blob/v0.6.1/server/pkg/agent/pi_test.go), [runtime rules](https://multica.ai/docs/daemon-runtimes).
- [Pi pinned CLI integration](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/cli-integration.md), [JSON event contract](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/json.md), [SDK](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/sdk.md), [RPC](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/rpc.md). No need for a custom transport bridge.
- [Bifrost OSS release](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.5), [pinned custom providers](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/providers/custom-providers.mdx), [pinned virtual keys](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/features/governance/virtual-keys.mdx).
- [Zen endpoints, pricing, limits, retention and reload](https://opencode.ai/docs/zen/). Provider marketing about coding-agent quality is not proof of research-task quality.
