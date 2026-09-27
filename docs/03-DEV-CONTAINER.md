# 03 — Dev Container

Optional layer that adds a browser-based development environment and an agent tool bridge to the core stack. The core stack (Open WebUI + Bifrost + TSDProxy) does not change.

## What this adds

```text
Your devices
    |
Tailscale
    |
TSDProxy
    |
    +--> devbox (code-server)  --> /workspace  (host directory)
    |
    +--> open-terminal         --> /home/user  (same directory; API key protected)
    |
    +--> mcp (mcpo)            --> /workspace  (same directory)
                |
                +--> Open WebUI (agent tool calls)

Open WebUI --> Bifrost --> model providers   (unchanged)
```

Development services:

- **devbox** — VS Code in the browser, running as a container. You edit and run projects against a mounted host directory. No Docker socket.
- **open-terminal** — Open Terminal command and file API, sharing the workspace. Protected by `OPEN_TERMINAL_API_KEY`; no Docker socket.
- **mcp** — `mcpo`, an MCP-to-OpenAPI proxy. It exposes a shell/filesystem MCP server so the Open WebUI agent can run allowlisted commands and touch files in the same workspace. Optional, behind a Compose profile.

## Design choices and tradeoffs

- **Separate container.** The dev environment is its own service, not part of the Open WebUI container.
- **Config-volume ownership.** A one-shot initializer fixes `devbox-config` ownership to code-server's UID/GID (`1000:1000`) before devbox starts, including on fresh volumes.
- **One shared workspace.** devbox and mcp mount the same host directory. You and the agent see the same files.
- **No Docker socket.** Only TSDProxy keeps that privilege. The dev layer cannot control Docker.
- **Not a hardened sandbox.** The workspace is writable host files. Allowlisted commands run inside the mcp container with the toolchain of that image. Treat it as a convenience boundary, not a security boundary for hostile code.

## Prerequisites

- Core stack installed and running (`./scripts/setup.sh`).
- OrbStack or Docker running.
- Tailscale joined (for the private `dev` URL; localhost works without it).

## Quick start

```bash
./scripts/dev.sh            # devbox + agent bridge
./scripts/dev.sh --no-mcp   # devbox only
```

The script creates `.env` if needed, generates `OPEN_TERMINAL_API_KEY` and `MCPO_API_KEY`, creates the workspace directory, and starts the merged stack.

Manual equivalent:

```bash
docker compose -f compose.yaml -f compose.dev.yaml --profile mcp up -d
```

## Step 1 — Open code-server locally

On the host:

```text
http://localhost:8443
```

You should land in VS Code running against `/workspace`. The port binds to `127.0.0.1` only.

## Step 2 — Reach it privately over Tailscale

Once TSDProxy is authenticated, open the name from its dashboard, conceptually:

```text
https://dev.<your-tailnet>.ts.net
```

This is the path you use from a phone, tablet, or second computer.

Note: `--auth none` means anyone who can reach that URL has full shell access to the workspace. That is acceptable inside a personal tailnet. If you share the tailnet, switch code-server to password auth (see below).

## Step 3 — Confirm the workspace

Pick the host directory with `DEV_WORKSPACE` in `.env`:

```text
DEV_WORKSPACE=./workspace          # default, gitignored
DEV_WORKSPACE=$HOME/ai-workspace   # recommended: outside the repo
```

Create a file in code-server, then check it on the host:

```bash
ls "${DEV_WORKSPACE:-./workspace}"
```

Both should match. Files persist across container restarts and are yours to back up.

## Step 4 — Use Open Terminal

Open locally at `http://localhost:8001` or privately at `https://terminal.<your-tailnet>.ts.net`. Authenticate with the value of `OPEN_TERMINAL_API_KEY` in `.env`. The API has command and file access to the shared workspace, so treat its key as a secret. Open Terminal runs in its own container and does not receive the Docker socket.

Ports and Tailscale name can be changed with `OPEN_TERMINAL_LOCAL_PORT` and `OPEN_TERMINAL_TS_NAME` in `.env`.

## Step 5 — Inspect the agent bridge

With the `mcp` profile running, open the generated OpenAPI docs:

```text
http://localhost:8000/shell/docs
```

You should see the tools exposed by `mcp-shell-server`. The API key is the value of `MCPO_API_KEY` in `.env`.

## Step 6 — Register the bridge in Open WebUI

In Open WebUI:

1. Open **Settings → Admin → Integrations**.
2. Under **External Tool Servers**, choose **+ Add Connection**.
3. Set **Type** to **OpenAPI**.
4. Set **URL** to `http://mcp:8000/shell`.
5. Set **Auth** to **Bearer** and paste `MCPO_API_KEY`.
6. Save.

Use the internal Docker name `mcp`, not `localhost`, because Open WebUI calls it over the stack network.

Then, in a chat, open the tools menu and enable the shell tools for that model.

## Step 7 — Test the agent

Ask the model to list the workspace and create a file:

```text
List the files in the working directory, then create hello.txt with one line.
```

Then confirm on the host:

```bash
cat "${DEV_WORKSPACE:-./workspace}/hello.txt"
```

If the model ignores the tools, that is usually the model, not the wiring. See the MCP docs note that MCP does not improve tool use.

## Command allowlist

The allowlist lives in `config/mcpo/config.json`:

```json
"ALLOW_COMMANDS": "ls,cat,pwd,grep,wc,find,mkdir,touch,rm,cp,mv,echo,python3,node,npm,git,head,tail,sed"
```

`mcp-shell-server` runs commands as argv (no shell string), blocks certain exec-capable flags, and keeps redirection inside the working directory. It is defense in depth, not a full sandbox. Edit the list and restart mcp:

```bash
docker compose -f compose.yaml -f compose.dev.yaml --profile mcp up -d mcp
```

## Tuning

- **Resource limits** — `DEVBOX_MEM_LIMIT`, `DEVBOX_CPUS`, `MCP_MEM_LIMIT`, `MCP_CPUS` in `.env`.
- **Workspace outside the repo** — set `DEV_WORKSPACE=$HOME/ai-workspace`.
- **Read-only workspace** — append `:ro` to a mount in `compose.dev.yaml` for inspect-only agents.
- **Code-server password** — mount a config with `auth: password` and a hashed password instead of `--auth none`.
- **Richer toolchain** — replace the `mcp` image with a custom image that has the languages you need, still without the Docker socket.

## Troubleshooting

**code-server does not open**

```bash
docker compose -f compose.yaml -f compose.dev.yaml ps
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=100 devbox
```

**"network personal-agentic-ai declared as external but could not be found"**

The core stack is not up. Start it first:

```bash
docker compose up -d
```

**Open WebUI tool call fails**

- Confirm the connection type is **OpenAPI**, not MCP.
- Confirm the URL is `http://mcp:8000/shell`.
- Confirm the key matches `MCPO_API_KEY`.
- Check the bridge is up and healthy:

```bash
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=100 mcp
curl -fsS http://localhost:8000/shell/docs >/dev/null && echo ok
```

**Workspace permission errors**

On macOS with OrbStack/Docker Desktop, bind-mount ownership is virtualized and usually just works. If not, check the host directory permissions and that it is writable by your user.

## Recovery

Stop the dev layer without touching core data:

```bash
docker compose -f compose.yaml -f compose.dev.yaml --profile mcp down
```

Recreate only the dev services:

```bash
docker compose -f compose.yaml -f compose.dev.yaml --profile mcp up -d --force-recreate devbox mcp
```

The workspace is host files, so it survives all of this. `devbox-config` holds editor settings only.
