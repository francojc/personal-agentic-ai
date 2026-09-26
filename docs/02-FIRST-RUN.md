# First Run

## 1. Start infrastructure
Run the platform-specific setup script. Confirm all three containers are running with `docker compose ps`.

## 2. Connect TSDProxy to Tailscale
Run `./scripts/tsdproxy-auth.sh` for the current auth links, or open `http://localhost:8080` and complete TSDProxy's interactive Tailscale authentication. Approve both nodes: `webui` (Open WebUI) and `gateway` (Bifrost). See `docs/01-TSDPROXY-FIRST-RUN.md`.

## 3. Configure Bifrost in its UI
Open `http://localhost:8081`. In the sidebar choose **Model Providers**, select one provider (for this workshop, **OpenRouter**), and add one API key. Paste the key into Bifrost, never into `.env`. Keep the first test intentionally boring: one provider, one key, one successful request. Bifrost addresses models as `provider/model`, for example `openrouter/<model-id>`.

The full guided walkthrough, including how to handle Bifrost's setup checklist and an optional hardening track, is in `docs/04-PROVIDER-AND-WORKSPACE.md`.

## 4. Create the Open WebUI owner account
Open `http://localhost:3000`. The first account becomes the administrator in a normal fresh Open WebUI install. The Compose bootstrap points its OpenAI-compatible connection at `http://bifrost:8080/v1`.

If models do not appear, go to **Admin Settings → Connections → OpenAI** and confirm the connection points at `http://bifrost:8080/v1`. Optionally add model IDs to the connection's **Model IDs (Filter)** allowlist in `provider/model` form.

## 5. Verify the chain
Select a Bifrost model in Open WebUI and send a short message. If models are missing, run `./scripts/doctor.sh` and check Bifrost's model catalog/logs.

## 6. Move to Tailscale URLs
Once private names work, use those URLs from your other Tailscale devices. Localhost remains a recovery path on the Docker host.
