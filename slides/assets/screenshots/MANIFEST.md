# Screenshot Manifest

Required captures for the deck. Naming: `NN-phase-step.png`, referenced from `slides/src/*.md`.

Capture guidance:

- 1600×900 or 2× scale to match the 16:9 frame
- Crop to content; no desktop clutter
- Redact keys, tokens, and tailnet identifiers
- Save into `slides/assets/screenshots/`

| File | Slide | Status | Notes |
|---|---|---|---|
| `20-docker-version.png` | Prerequisites → Prove your runtime works | pending | Terminal showing both commands succeeding |
| `30-setup-run.png` | The Stack → Start it | pending | `setup.sh` output with containers started |
| `40-auth-helper.png` | Private Access → Authenticate the nodes | pending | `tsdproxy-auth.sh` output |
| `41-tsdproxy-dashboard.png` | Private Access → Find your private URLs | pending | Dashboard with `webui` and `gateway` |
| `50-bifrost-checklist.png` | Provider → The Bifrost checklist | pending | Setup checklist, four items |
| `51-bifrost-provider.png` | Provider → Add the provider key | pending | Model Providers → OpenRouter, key redacted |
| `52-bifrost-logs.png` | Provider → Verify Bifrost directly | pending | A logged request |
| `60-webui-connection.png` | Workspace → Confirm the connection | pending | Admin → Connections → OpenAI |
| `61-webui-chat.png` | Workspace → Send the first request | pending | Model selected plus a reply |
| `70-devbox.png` | Dev Container → Start it | pending | code-server with the workspace |
| `42-second-device.png` | Private Access → Prove it is private | optional | Two-panel: connected vs disconnected |

Status values: `pending`, `captured`, `optional`.
