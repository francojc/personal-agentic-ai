# 01 — TSDProxy First Run

TSDProxy is the private front door for this stack. It watches Docker, finds containers that opt in with labels, and creates private Tailscale-accessible proxies for them.

For this project, TSDProxy publishes two services:

- **`webui`** → Open WebUI
- **`gateway`** → Bifrost's browser UI

Open WebUI still talks to Bifrost directly over the Docker network. Tailscale is for *you* to reach the browser interfaces.

> This guide targets the stable TSDProxy v2 series. Do not switch the beginner install to a v3 alpha image unless you intentionally want to test the new architecture.

## Before starting

You should already have:

- Docker or OrbStack running
- `docker compose version` working
- a Tailscale account/tailnet
- the host computer joined to that tailnet
- preferably a second device joined to the same tailnet

Start the stack normally:

```bash
./scripts/setup.sh
```

or on Windows:

```powershell
.\scripts\setup.ps1
```

Then verify:

```bash
docker compose ps
```

You should see TSDProxy, Open WebUI, and Bifrost running.

## Step 1 — Open the local TSDProxy dashboard

On the computer hosting the stack, open:

```text
http://localhost:8080
```

The dashboard is deliberately exposed only on localhost for bootstrap/recovery. It is not intended to be a public web service.

If it does not open:

```bash
docker compose ps
docker compose logs tsdproxy
```

## Step 2 — Authenticate TSDProxy to your tailnet

If TSDProxy has not yet joined a tailnet, the dashboard should show the proxies in an authentication/pending state and provide the initial Tailscale authentication flow.

Follow the authentication link shown by TSDProxy.

In the Tailscale page:

1. Sign in with the **same account/tailnet** you created during prerequisites.
2. Approve the TSDProxy node/service when prompted.
3. Return to the TSDProxy dashboard.

TSDProxy stores its Tailscale state in persistent data. You should not need to authenticate again after ordinary container restarts.

If the dashboard does not expose a usable authentication link, use the helper:

```bash
./scripts/tsdproxy-auth.sh
```

It prints the latest auth URL per hostname, filtered to the current container run. Two nodes need approval: `webui` (Open WebUI) and `gateway` (Bifrost). Auth URLs are single-use and regenerate when tsdproxy restarts, so click them promptly.

Underlying logs, if you prefer:

```bash
docker compose logs -f tsdproxy
```

The Tailscale/tsnet enrollment flow emits the authentication URL in the logs.

> **Hostname sanity check.** The published names come from `OPENWEBUI_TS_NAME` and `BIFROST_TS_NAME` in `.env` (`webui` and `gateway` by default). If logs show unexpected names, either your `.env` values differ, or you are running the TSDProxy v3 beta instead of the pinned v2 line. See `docs/RESEARCH-NOTES.md`.

## Step 3 — Confirm Docker discovery

The Compose file opts Open WebUI and Bifrost into TSDProxy using Docker labels such as:

```yaml
labels:
  tsdproxy.enable: "true"
  tsdproxy.name: "webui"
```

and:

```yaml
labels:
  tsdproxy.enable: "true"
  tsdproxy.name: "gateway"
```

Return to the TSDProxy dashboard.

You should see entries for both services. Wait until they report a healthy/running state rather than authentication, error, or pending status.

If one is missing:

```bash
docker compose ps
docker compose logs tsdproxy
```

Then inspect the labels Docker actually sees:

```bash
docker inspect personal-agentic-ai-open-webui-1
docker inspect personal-agentic-ai-bifrost-1
```

Container names can differ, so use `docker compose ps` to find the exact names.

## Step 4 — Find the private URLs

Once authenticated and running, TSDProxy should display the Tailscale hostname/FQDN for each proxy.

They will conceptually look like:

```text
https://webui.<your-tailnet>.ts.net
https://gateway.<your-tailnet>.ts.net
```

Use the exact names shown in your dashboard. Do not manually invent the tailnet suffix.

TSDProxy uses Tailscale/MagicDNS and automatically supports TLS for these private services.

## Step 5 — Test Open WebUI

From the host computer, open the `webui` URL shown by TSDProxy.

You should reach Open WebUI.

Complete Open WebUI's initial account setup if this is a fresh installation.

## Step 6 — Test Bifrost

Open the `gateway` URL shown by TSDProxy.

You should reach Bifrost's management UI.

Do not add provider keys yet if you are following the main walkthrough. The next chapter handles the first provider and model.

## Step 7 — Prove it is really private

This is the useful test.

On a **second device already joined to the same tailnet**:

1. Open the `webui` URL.
2. Open the `gateway` URL.
3. Confirm both load.

Then temporarily disconnect Tailscale on that second device and try again. The private tailnet URLs should no longer be reachable through the normal Tailscale path.

Reconnect Tailscale when finished.

## Step 8 — Verify persistence

Restart the stack:

```bash
docker compose restart
```

Wait a few moments, then revisit:

```text
http://localhost:8080
```

TSDProxy should reconnect using its persisted state rather than requiring a fresh enrollment.

The two private URLs should return.

## Troubleshooting ladder

Use these in order rather than changing several settings at once.

### A. Is Docker healthy?

```bash
docker version
docker compose version
docker compose ps
```

### B. Is TSDProxy running?

```bash
docker compose logs --tail=100 tsdproxy
```

### C. Are the application services healthy locally?

```text
Open WebUI: http://localhost:3000
Bifrost:    http://localhost:8081
TSDProxy:   http://localhost:8080
```

If the local application works but the Tailscale URL does not, focus on TSDProxy/Tailscale rather than Open WebUI or Bifrost.

### D. Does TSDProxy see the services?

Check the dashboard and confirm both `webui` and `gateway` appear.

If they do not, inspect Docker labels and TSDProxy's Docker-socket access.

### E. Is the proxy waiting for authentication?

Complete the authentication link from the dashboard or inspect TSDProxy logs for the enrollment URL.

### F. Does Tailscale see the proxy?

Open the Tailscale admin console and inspect **Machines**. Confirm the relevant TSDProxy-created node(s) exist and are connected.

### G. Does the second device belong to the same tailnet?

Open the Tailscale client on the second device and confirm it is signed into the same account/tailnet.

## Recovery

Do **not** delete TSDProxy's persistent data as a first troubleshooting step. Its `/data` state contains Tailscale machine identity and related state. Deleting it can force new Tailscale identities/enrollment.

The safe first recovery sequence is:

```bash
docker compose restart tsdproxy
docker compose logs --tail=100 tsdproxy
```

If necessary:

```bash
docker compose pull tsdproxy
docker compose up -d tsdproxy
```

Keep the persistent volumes intact.

## Success checkpoint

Do not continue until all four are true:

```text
TSDProxy dashboard opens locally .......... ✓
webui proxy shows running ................. ✓
gateway proxy shows running ............... ✓
both private URLs work from second device . ✓
```

Next: configure your first provider in Bifrost.
