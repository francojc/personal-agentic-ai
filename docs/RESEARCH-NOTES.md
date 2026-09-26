# Implementation research notes

These notes capture design assumptions that should be rechecked when updating pinned versions.

- Open WebUI stores `/app/backend/data` persistently. `OPENAI_API_BASE_URL` is a persistent ConfigVar: seed it at first launch, then administer it through the UI. A stable `WEBUI_SECRET_KEY` avoids invalidating sessions/encrypted tokens after container recreation.
- Bifrost supports zero-configuration startup and a built-in UI. Docker app data under `/app/data` contains its config database and logs. Provider credentials and model assignments can be configured through the UI. `BIFROST_ENCRYPTION_KEY` protects stored sensitive configuration and must remain stable after data exists.
- Bifrost exposes OpenAI-compatible `/v1/chat/completions`; Open WebUI therefore needs only the Bifrost OpenAI-compatible connection for the basic architecture.
- TSDProxy discovers Docker services using labels such as `tsdproxy.enable=true` and `tsdproxy.name=...`; its documented deployment mounts the Docker socket and persistent `/data`/`/config` storage.
- V1 intentionally binds bootstrap ports only to loopback. It does not require public DNS, router port forwarding, Nginx, Caddy, or provider API keys in `.env`.
