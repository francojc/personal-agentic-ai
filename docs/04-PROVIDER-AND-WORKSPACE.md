# 04 — Provider and Workspace Setup

Add one model provider in Bifrost, connect it to Open WebUI, and use it. This is the first "real" milestone: a request that leaves Open WebUI, flows through Bifrost, reaches a provider, and comes back.

## What this covers

- Handling Bifrost's setup checklist without breaking the stack
- Adding one provider key (OpenRouter)
- Verifying Bifrost directly
- Confirming the Open WebUI connection and model discovery
- Sending the first request end to end
- An optional hardening track (dashboard auth, virtual keys, enforced inference auth)

## Before you start

- Core stack running: `docker compose ps` shows `open-webui`, `bifrost`, `tsdproxy` as `running`
- TSDProxy authenticated: `./scripts/tsdproxy-auth.sh` reports no pending URLs
- Diagnostics green: `./scripts/doctor.sh`
- The TSDProxy dashboard names handy: `webui` (Open WebUI) and `gateway` (Bifrost)
- The OpenRouter API key from pre-work, stored securely

## The Bifrost setup checklist

On first login, Bifrost shows a **Setup checklist** with four items:

| Checklist item | Workshop action | Reason |
|---|---|---|
| **Add a provider key** | Do it | The core task. The provider credential lives in Bifrost. |
| Restrict CORS origins | Skip | Open WebUI talks to Bifrost server-to-server, so browser CORS does not apply here. |
| Set up dashboard auth | Skip (mention) | Fine on a private tailnet; part of the hardening track. |
| Enforce auth on inference | Skip (mention) | Enabling this without a virtual key breaks the Open WebUI connection. |

For the skipped items, choose **Remind me later**, or **I accept the risk – hide for everyone** if you want a clean interface.

Why skipping is acceptable for this workshop:

- Inference ports bind `127.0.0.1`, not the LAN.
- The only network exposure is the private tailnet.
- This is a personal, private workspace, not an Internet-facing gateway.

> **Do not enable "Enforce auth on inference" early.** It requires a Bifrost virtual key, and Open WebUI's seeded connection uses `not-required`. See the hardening track below for the correct order.

## Part 1 — Add a provider key

In Bifrost at `http://localhost:8081` (or `gateway.<your-tailnet>.ts.net`):

1. Open the sidebar and choose **Model Providers**.
2. Select **OpenRouter**.
3. Add one key. Give it a recognizable name, for example `workshop-openrouter`.
4. Paste your `sk-or-v1-…` key. **Paste it here only.** Never into `.env`, Git, screenshots, or notes.
5. Leave the model scope at `["*"]` for the first test. A short allowlist comes later.
6. Save.

Teaching beat: Bifrost owns the credential. Open WebUI never sees the raw provider key, and Bifrost addresses models as `provider/model`.

## Part 2 — Verify Bifrost directly

Confirm the gateway works before involving Open WebUI. One provider, one model, one request.

List the models Bifrost now exposes:

```bash
curl -fsS http://localhost:8081/v1/models
```

Send a one-shot completion (replace the model ID with one from the list):

```bash
curl -fsS http://localhost:8081/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"openrouter/<model-id>","messages":[{"role":"user","content":"ping"}]}'
```

Then open **Logs** in the Bifrost UI and confirm the request appears.

Checkpoint: Bifrost answers, and the request is logged.

## Part 3 — Confirm the Open WebUI connection

Open WebUI at `http://localhost:3000` (or `webui.<your-tailnet>.ts.net`).

The Compose bootstrap already seeds the OpenAI-compatible connection:

- URL: `http://bifrost:8080/v1`
- Key: `not-required`

To verify or adjust it:

1. Go to **Admin Settings → Connections → OpenAI**.
2. Confirm the connection URL is `http://bifrost:8080/v1`.
3. Save.
4. If model auto-discovery is noisy, add entries to the connection's **Model IDs (Filter)** allowlist in `provider/model` form, for example `openrouter/<model-id>`.

Use the internal Docker name `bifrost`, not `localhost`, because Open WebUI calls Bifrost over the stack network.

## Part 4 — Use it

1. Start a new chat.
2. Open the model selector and choose a Bifrost-backed model.
3. Send a short message.
4. Confirm the reply appears, and that the request shows in Bifrost **Logs**.
5. Optional: attach an image to a vision-capable model to show multimodal routing.

## Success checkpoint

The whole chain works when all of these are true:

```text
Provider key saved in Bifrost ............................ ✓
Bifrost /v1/models lists models .......................... ✓
Bifrost logs show the request ............................ ✓
Open WebUI connection points at bifrost:8080/v1 .......... ✓
Selected model replies in Open WebUI ..................... ✓
```

The data path:

```text
Open WebUI --> http://bifrost:8080/v1 --> Bifrost --> OpenRouter --> model
```

## Screenshots to capture for the tutorial

| Step | Capture |
|---|---|
| Provider add | Model Providers → OpenRouter, key saved (redact the key) |
| Bifrost logs | A logged request |
| Open WebUI connection | Admin Settings → Connections → OpenAI |
| Chat success | Model selected plus a reply |
| Privacy proof | Tailnet URL working, then failing with Tailscale off |

## Hardening track (optional)

Do these later, and do them in order. Done out of order, you break the Open WebUI to Bifrost link mid-session.

1. **Set up dashboard auth** — lock the Bifrost UI to you.
2. **Create a virtual key** in Bifrost, with budget and rate limits.
3. **Enforce auth on inference**.
4. **Update the Open WebUI key** to the virtual key: **Admin Settings → Connections → OpenAI → API Key**, and set `BIFROST_OPENWEBUI_KEY` in `.env`.
5. Optionally **restrict CORS origins** if any browser-based client calls Bifrost directly.

If a participant enabled **Enforce auth on inference** early and the connection broke, the recovery is:

```text
Bifrost: create a virtual key
Open WebUI: Admin Settings -> Connections -> OpenAI -> API Key = <virtual key> -> Save
```

## Troubleshooting

**No models appear in Open WebUI**

- Confirm the connection URL is `http://bifrost:8080/v1`.
- Run `curl -fsS http://localhost:8081/v1/models` and check Bifrost lists models.
- Check Bifrost logs for provider authentication errors (usually a bad or expired key).
- Run `./scripts/doctor.sh`.

**Requests fail after enabling inference auth**

- The Open WebUI connection key must be a valid Bifrost virtual key. See the hardening recovery above.

**Bifrost UI is reachable by others on the tailnet**

- That is expected until you complete **Set up dashboard auth** in the hardening track.

See `docs/02-FIRST-RUN.md` for the condensed path and `docs/01-TSDPROXY-FIRST-RUN.md` for the Tailscale layer.
