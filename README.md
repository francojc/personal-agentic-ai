# Personal Agentic AI

A private, UI-first AI workspace built from **Open WebUI + Bifrost + TSDProxy + Tailscale**.

The goal is simple: install the container runtime and Tailscale once, start the stack, then do normal model and workspace configuration in the browser.

## Before the workshop

Please complete these tasks **before workshop day**. We want to spend the workshop building and using the AI stack, not waiting for downloads or creating accounts.

### Pre-work checklist

- [ ] Install a container runtime: **OrbStack or Docker Desktop on macOS**, **Docker Desktop on Windows**, or **Docker Engine + Compose on Linux**
- [ ] Verify `docker version`
- [ ] Verify `docker compose version`
- [ ] Create a **Tailscale** account/tailnet
- [ ] Install Tailscale and join the workshop computer to your tailnet
- [ ] Recommended: join a phone/tablet/second computer to the same tailnet
- [ ] Create an **OpenRouter** account
- [ ] Add **$5 USD** of OpenRouter credits
- [ ] Create a dedicated API key named something recognizable, such as `agentic-ai-workshop`
- [ ] Set that key's spending/credit limit to **$5**
- [ ] Save the API key securely. **Do not paste it into this repo, Git, screenshots, chat, or workshop notes.**
- [ ] Bring the computer you prepared and make sure you can sign in to Tailscale and OpenRouter

> **Keep your OpenRouter API key private.** During the workshop you will paste it directly into your own Bifrost UI. It does not belong in `.env`, `compose.yaml`, the GitHub repo, or a shared document.

## 0. Before you clone the repo

You need two things:

1. A Docker-compatible container runtime with Docker Compose.
2. A personal Tailscale account (a **tailnet**) and the Tailscale app on at least the computer hosting this stack.

### 0A. Install a container runtime

#### macOS — choose one

**Option A: OrbStack (recommended macOS path)**

OrbStack is a lightweight Docker Desktop alternative for macOS and includes Docker/Compose compatibility.

1. Download and install OrbStack from its official site.
2. Launch OrbStack once and complete its setup.
3. Open Terminal and verify:

```bash
docker version
docker compose version
```

**Option B: Docker Desktop**

1. Download Docker Desktop for your Mac (Apple silicon or Intel).
2. Install and launch Docker Desktop.
3. Complete its initial setup prompts.
4. Verify in Terminal:

```bash
docker version
docker compose version
```

#### Windows — Docker Desktop

1. Install or update WSL 2 if needed.
2. Install Docker Desktop using the normal per-user installation.
3. Use the WSL 2 backend, which is the normal choice for most users.
4. Launch Docker Desktop.
5. Open PowerShell and verify:

```powershell
docker version
docker compose version
```

#### Linux — Docker Engine + Compose plugin

Use Docker's installation instructions for your distribution. Docker Desktop for Linux is also possible, but Docker Engine plus the Compose plugin is the lean server-style setup.

Verify:

```bash
docker version
docker compose version
```

> **Stop here if either command fails.** The stack cannot start until Docker and Compose both work.

### 0B. Create your Tailscale account

Tailscale calls your private network a **tailnet**.

1. Go to Tailscale and choose **Get Started**.
2. Sign in with a supported identity provider such as Google, Microsoft, GitHub, or Apple.
3. Choose **Personal use** during onboarding.
4. Install the Tailscale client for your operating system when prompted.
5. Sign the client into the **same account** used to create the tailnet.
6. Confirm that the computer appears under **Machines** in the Tailscale admin console.

You do **not** need to create a Tailscale auth key for this beginner installation.

#### Recommended: add a second device

Install Tailscale on your phone, tablet, or another computer and sign into the same tailnet. Later, this gives you an easy test that Open WebUI and Bifrost are actually reachable privately through Tailscale.

### 0C. Prepare OpenRouter for the workshop

OpenRouter will be our first model provider because one account/API gives the workshop access to many models without requiring everyone to create accounts with several model vendors.

1. Create/sign in to your OpenRouter account.
2. Open **Credits / Billing** and purchase **$5 USD** of credits.
3. Open **API Keys** and create a new key.
4. Give it a recognizable name, for example:

```text
agentic-ai-workshop
```

5. Set the key's **credit/spending limit to $5**. For this workshop, use a non-resetting limit if the UI offers that choice; we want a simple cap rather than a recurring allowance.
6. Create the key.
7. **Copy the key immediately and store it in your password manager or another secure place.**

The key will look roughly like:

```text
sk-or-v1-••••••••••••••••••••••••
```

Do not use a real key in screenshots or documentation.

During the workshop, this key will go here:

```text
OpenRouter API key
        ↓
   Bifrost UI
        ↓
 provider configuration
        ↓
 Open WebUI sees models
```

It will **not** be committed to Git or added to the project's `.env`.

At this point:

```text
Container runtime
  └─ docker + docker compose ✓

Tailscale
  ├─ personal tailnet ✓
  ├─ host computer joined ✓
  └─ second device (recommended) ✓
```

Now continue with the stack installation below.

> **New to TSDProxy?** After the stack starts, follow [`docs/01-TSDPROXY-FIRST-RUN.md`](docs/01-TSDPROXY-FIRST-RUN.md) before configuring Bifrost. It walks through the local dashboard, Tailscale enrollment, Docker discovery, private URLs, second-device testing, persistence, and recovery.

---

A small, private, UI-first AI workspace built from **Open WebUI + Bifrost + TSDProxy/Tailscale**.

## Philosophy

Docker Compose installs and runs the infrastructure. After first boot, normal configuration happens in the browser:

- **Open WebUI** — chats, models, knowledge, tools, agents and workspace settings.
- **Bifrost** — model providers, API keys, model access, routing, logs and usage.
- **TSDProxy + Tailscale** — private HTTPS access from your devices.

Provider credentials do **not** belong in this repository or the default `.env`.

## Quick start

### macOS / Linux

```bash
git clone <YOUR-REPO-URL>
cd personal-agentic-ai
./scripts/setup.sh
```

### Windows PowerShell

```powershell
git clone <YOUR-REPO-URL>
cd personal-agentic-ai
.\scripts\setup.ps1
```

The scripts create a private `.env`, generate persistent application encryption/signing secrets, pull images, and start the stack.

## First run

1. Open **TSDProxy** at `http://localhost:8080` and complete its Tailscale setup.
2. Open **Bifrost** at `http://localhost:8081`. Add one model provider and API key in its UI.
3. Open **Open WebUI** at `http://localhost:3000`, create the first account, and verify that Bifrost-backed models appear.
4. Once TSDProxy is authenticated, prefer the private Tailscale HTTPS names (`ai` and `bifrost`) for normal use.

Open WebUI is pre-seeded to use `http://bifrost:8080/v1` on first launch. Open WebUI stores that connection in its persistent configuration afterward, so later changes can be made in its Admin UI.

## What is exposed?

The three localhost ports are bound to `127.0.0.1`, so they are bootstrap/admin access from the host only. TSDProxy publishes labeled services privately to your tailnet. Bifrost remains reachable directly from Open WebUI over the internal Docker network.

## Diagnostics

```bash
./scripts/doctor.sh
```

## Important security notes

- Never commit `.env`.
- Do not change `BIFROST_ENCRYPTION_KEY` after Bifrost has stored encrypted configuration unless you intend to reset its database.
- Keep `WEBUI_SECRET_KEY` stable across container recreation.
- TSDProxy receives access to the Docker socket. Treat it as trusted infrastructure.
- The default is a personal, private-tailnet configuration, not an Internet-facing production deployment.

## Next layers

Once the core stack works, add capabilities progressively: web/search and knowledge, MCP/OpenAPI tools, Open Terminal/code execution, local models, and hardened Bifrost authentication/virtual keys.

See `docs/ARCHITECTURE.md`, `docs/02-FIRST-RUN.md`, and [`docs/03-DEV-CONTAINER.md`](docs/03-DEV-CONTAINER.md).

## Optional dev container

An optional dev layer adds a browser-based VS Code (`devbox`) plus an agent tool bridge (`mcp`/mcpo) over a shared host workspace. Neither gets the Docker socket.

```bash
./scripts/dev.sh            # devbox + agent bridge
./scripts/dev.sh --no-mcp   # devbox only
```

See [`docs/03-DEV-CONTAINER.md`](docs/03-DEV-CONTAINER.md).
