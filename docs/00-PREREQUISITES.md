# 00 — Prerequisites

Complete this before running the Personal Agentic AI setup scripts.

## 1. Install a container runtime

The project requires a Docker-compatible runtime and Docker Compose.

### macOS

Choose either:

- **OrbStack** — recommended for a lightweight macOS experience; Docker and Compose compatible.
- **Docker Desktop** — the standard cross-platform Docker experience.

Verify:

```bash
docker version
docker compose version
```

### Windows

Use Docker Desktop with its WSL 2 backend for the normal beginner path.

Verify in PowerShell:

```powershell
docker version
docker compose version
```

### Linux

Use Docker Engine plus the Docker Compose plugin, or Docker Desktop if preferred.

Verify:

```bash
docker version
docker compose version
```

Do not continue until both commands succeed.

## 2. Create a Tailscale account and tailnet

1. Open Tailscale's Get Started page.
2. Sign in with a supported identity provider.
3. Select **Personal use**.
4. Install Tailscale on the computer that will host this stack.
5. Authenticate the app using the same account.
6. Open the Tailscale admin console and confirm the computer appears under **Machines**.

### Recommended: add a second device

Install Tailscale on a phone, tablet, or second computer and join the same tailnet. Later, use it to verify the private TSDProxy URLs.


## 3. Prepare an OpenRouter workshop account

OpenRouter is the default first provider for the workshop.

1. Create or sign in to an OpenRouter account.
2. Add **$5 USD** of credits.
3. Go to **API Keys** and create a dedicated key named, for example, `agentic-ai-workshop`.
4. Set the key's **spending/credit limit to $5**. Prefer a non-resetting limit for the workshop rather than a recurring daily/weekly/monthly allowance.
5. Copy the new API key and store it securely, preferably in a password manager.

### Treat the API key like a password

Never put the key in:

- Git or GitHub
- `compose.yaml`
- `.env`
- screenshots
- workshop notes
- chat messages
- shared documents

You will paste it directly into **your own Bifrost browser UI** during the workshop.

If you accidentally expose it, revoke/delete the key in OpenRouter and create a new one.

### Workshop budget model

```text
OpenRouter account
     │
     ├── $5 purchased credit
     │
     └── agentic-ai-workshop key
             │
             └── $5 key limit
```

This gives us enough credit for workshop experimentation while putting an intentional ceiling on the workshop credential.

## 4. Pre-work completion check

Before workshop day, confirm:

```text
Docker/OrbStack running ............... ✓
docker version ........................ ✓
docker compose version ................ ✓
Tailscale account created ............. ✓
workshop computer joined to tailnet ... ✓
second device joined (recommended) .... ✓
OpenRouter account created ............ ✓
$5 OpenRouter credit added ............ ✓
workshop API key created .............. ✓
$5 key limit set ...................... ✓
API key stored securely ............... ✓
```

If every item is checked, you are ready for the workshop.


## 5. What you do not need yet

You do **not** need accounts or API keys for OpenAI, Anthropic, Google, or other direct model providers. We will begin with OpenRouter and add other providers later if desired.

You also do not need a Tailscale auth key, public domain name, TLS certificate, Nginx, or Caddy.
