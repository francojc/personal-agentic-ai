# First Run

## 1. Start infrastructure
Run the platform-specific setup script. Confirm all three containers are running with `docker compose ps`.

## 2. Connect TSDProxy to Tailscale
Open `http://localhost:8080`. Complete TSDProxy's interactive Tailscale authentication/configuration. The labeled Open WebUI and Bifrost services should then receive private tailnet names.

## 3. Configure Bifrost in its UI
Open `http://localhost:8081`. Add **one** provider first. Paste its API key in Bifrost rather than `.env`. Keep the first test intentionally boring: one provider, one model, one successful request.

## 4. Create the Open WebUI owner account
Open `http://localhost:3000`. The first account becomes the administrator in a normal fresh Open WebUI install. The Compose bootstrap points its OpenAI-compatible connection at `http://bifrost:8080/v1`.

## 5. Verify the chain
Select a Bifrost model in Open WebUI and send a short message. If models are missing, run `./scripts/doctor.sh` and check Bifrost's model catalog/logs.

## 6. Move to Tailscale URLs
Once private names work, use those URLs from your other Tailscale devices. Localhost remains a recovery path on the Docker host.
