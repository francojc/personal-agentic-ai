# Personal Agentic OS
## Operations Runbook

**Pilot deployment:** Proxmox control-plane VM + GPU privacy VPS + administrator workstation  
**Version:** 0.1  
**Date:** October 2026

> **Operating principle:** keep coordination, policy, memory, and audit state on the home control plane; use OpenCode Zen for non-sensitive cognition; route sensitive prompts to a narrow GPU VPS inference endpoint; never let a private route auto-escalate to an external model provider.

---

# 1. Purpose and Scope

This runbook is the operational companion to the *Personal Agentic OS* white paper. It is written for a single-user pilot and covers initial build, service ownership, normal operations, health checks, backups, upgrades, failure recovery, and security boundaries across all hosts.

The pilot has three physical/virtual locations:

1. **Proxmox control plane VM** — durable coordination, routing, memory, agent execution, MCP services, and observability.
2. **GPU privacy VPS** — a deliberately narrow, OpenAI-compatible private-model endpoint reachable only over Tailscale.
3. **Administrator workstation** — browser/CLI access, repository maintenance, emergency administration, and optional Multica runtime for work that must happen on the workstation.

Non-sensitive model inference is purchased elastically through **OpenCode Zen**, accessed through **Bifrost**. Sensitive model inference is sent to the GPU VPS.

## 1.1 Service inventory

| Service | Host | Function | Persistence | Public exposure |
|---|---|---|---|---|
| Multica frontend/backend | Proxmox VM | Human control surface, issues, agents, run history | Multica DB | None; Tailscale/reverse proxy only |
| Multica Postgres | Proxmox VM | Multica application state | Named volume | None |
| Bifrost | Proxmox VM | Model/provider gateway, aliases, MCP, usage tracking | `/srv/paos/bifrost` | None |
| Decision server (`llama.cpp`) | Proxmox VM | First-pass classification via `/v1/systemone` | model volume | None |
| Policy service | Proxmox VM | Deterministic routing and approval policy | config + DB telemetry | None |
| Memory Postgres + pgvector | Proxmox VM | Durable project/personal/agent memory | named volume + dumps | None |
| Redis | Proxmox VM | Queues, cache, locks, ephemeral run state | optional AOF volume | None |
| Pi runtime/agents | Proxmox VM | Bounded execution workflows | workspaces + logs | None |
| MCP servers | Proxmox VM | Tool interfaces | tool-specific | via Bifrost only |
| Prometheus | Proxmox VM | Metrics collection | named volume | None |
| Grafana | Proxmox VM | Operations dashboards | named volume | Tailscale only |
| Caddy | Proxmox VM | Tailnet-only reverse proxy/TLS if desired | config | Tailscale only |
| vLLM privacy endpoint | GPU VPS | Private model inference | model/cache volume | Tailscale only |
| Tailscale | VM host + VPS host + admin workstation | Private network identity and access policy | host state | Tailnet |

---

# 2. Architecture at a Glance

```text
                         ADMIN WORKSTATION
                    browser • git • ssh • CLI
                              │
                           TAILSCALE
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────────────────┐          ┌──────────────────────┐
│ PROXMOX CONTROL-PLANE VM     │          │ GPU PRIVACY VPS      │
│ Ubuntu Server + Docker       │          │ Ubuntu + NVIDIA      │
│                              │          │ Docker + vLLM        │
│ Multica                      │          │                      │
│ Decision model / llama.cpp   │◄────────►│ private model        │
│ Policy service               │          │ :8000 tailnet only   │
│ Bifrost                      │          └──────────────────────┘
│ Pi runtime + MCP             │
│ Postgres/pgvector + Redis    │
│ Prometheus + Grafana         │
└──────────────┬───────────────┘
               │
               │ HTTPS outbound
               ▼
        ┌─────────────────┐
        │ OpenCode Zen    │
        │ Small/Bal/Deep  │
        └─────────────────┘
```

The design intentionally uses **host-level Tailscale** rather than a Docker sidecar. Containers use ordinary bridge networks; the VM and VPS provide stable tailnet identities and firewall boundaries.

---

# 3. Naming, Paths, and Conventions

Use predictable names from day one.

## 3.1 Hostnames

| Role | Suggested hostname | Tailscale tag |
|---|---|---|
| Proxmox node | `pve-home` | `tag:infra` |
| Control-plane VM | `paos-control` | `tag:paos-control` |
| GPU privacy VPS | `paos-private-gpu` | `tag:paos-private` |
| Admin workstation | existing hostname | user identity or `tag:paos-admin` |

## 3.2 Filesystem layout on control VM

```text
/srv/paos/
├── repo/                       # git checkout for this stack
│   ├── compose.yml
│   ├── compose.multica.yml     # optional vendor/override layer
│   ├── .env                    # never commit
│   ├── .env.example
│   ├── configs/
│   │   ├── bifrost/
│   │   ├── policy/
│   │   ├── prometheus/
│   │   ├── grafana/
│   │   └── caddy/
│   ├── db/
│   │   ├── init/
│   │   └── migrations/
│   ├── mcp/
│   ├── policy/
│   └── scripts/
├── data/
│   ├── bifrost/
│   ├── models/decision/
│   ├── pi/workspaces/
│   ├── mcp/
│   └── backups/
└── logs/                       # only if host-side logs are required
```

Prefer **named Docker volumes** for databases and app state, and bind mounts for configuration, model files, workspaces, and exportable backups.

## 3.3 Operational shell convention

All examples assume:

```bash
cd /srv/paos/repo
```

Set a shell alias if useful:

```bash
alias paos='cd /srv/paos/repo'
```

---

# 4. Host Build: Proxmox Control-Plane VM

## 4.1 VM sizing

Start with:

| Resource | Pilot allocation |
|---|---:|
| vCPU | 8–12 |
| RAM | 24–32 GB |
| Root disk | 32 GB |
| Data disk | 150–250 GB SSD-backed |
| NIC | VirtIO, trusted LAN/VLAN |
| OS | Ubuntu Server 24.04 LTS or current supported LTS |
| GPU | None required |

Use a separate virtual disk mounted at `/srv` if convenient. This makes application data easier to back up and resize independently from the OS.

## 4.2 Base OS preparation

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git jq make openssl unzip htop vim ufw
sudo timedatectl set-timezone America/New_York
```

Create a dedicated service administrator:

```bash
sudo adduser paos
sudo usermod -aG sudo paos
```

Do not run the stack from `/root`.

## 4.3 Docker Engine

Install Docker Engine from Docker's official repository. After installation:

```bash
sudo usermod -aG docker paos
newgrp docker
docker version
docker compose version
```

Enable Docker:

```bash
sudo systemctl enable --now docker
```

## 4.4 Host firewall

Default stance: deny unsolicited inbound LAN/public traffic; allow SSH from the trusted LAN if desired; allow all traffic arriving on `tailscale0` only as constrained by Tailscale Grants.

Example UFW baseline:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
# Optional LAN SSH:
sudo ufw allow from <TRUSTED_LAN_CIDR> to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Do **not** expose Bifrost, Postgres, Redis, llama.cpp, Grafana, or Multica backend directly to the public Internet.

---

# 5. Tailscale Integration

Install Tailscale on the **control VM host**, **GPU VPS host**, and **admin workstation**. Do not put Tailscale inside the application containers for v0.1.

On Linux hosts:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

For unattended servers, use tagged auth keys created in the Tailscale admin console.

## 5.1 Tailnet policy

Tailscale recommends **Grants** for new deployments. The intent for this pilot is:

- admin workstation → control VM: administrative/UI ports
- control VM → privacy VPS: inference port 8000 only
- privacy VPS → control VM: no initiated connections by default
- ordinary tailnet devices → privacy VPS: no direct access

Conceptual policy:

```json
{
  "tagOwners": {
    "tag:paos-control": ["autogroup:admin"],
    "tag:paos-private": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["autogroup:member"],
      "dst": ["tag:paos-control"],
      "ip": ["tcp:443", "tcp:22"]
    },
    {
      "src": ["tag:paos-control"],
      "dst": ["tag:paos-private"],
      "ip": ["tcp:8000", "tcp:22"]
    }
  ]
}
```

Treat that as a template. Test it in Tailscale's policy editor before saving.

## 5.2 DNS names

Enable MagicDNS. Use tailnet hostnames rather than hard-coded `100.x.y.z` addresses where possible:

```text
paos-control.<tailnet>.ts.net
paos-private-gpu.<tailnet>.ts.net
```

## 5.3 Connectivity checks

From admin workstation:

```bash
tailscale status
ping paos-control
ssh paos@paos-control
```

From control VM:

```bash
tailscale status
curl -sS http://paos-private-gpu:8000/v1/models
```

The final command should fail until the privacy endpoint is installed, but the network path should be reachable.

---

# 6. Repository and Compose Project

## 6.1 Project strategy

Use **one Docker Compose project** on the VM, assembled from our stack plus Multica's official self-host configuration. This avoids copying Multica's internal service definitions and makes upgrades less brittle.

Suggested repository:

```text
repo/
├── compose.yml                 # PAOS-owned services
├── compose.override.yml        # local changes; optional
├── vendor/
│   └── multica/                # pinned Multica release checkout
├── .env.example
├── .gitignore
├── configs/
├── db/
├── policy/
├── mcp/
└── scripts/
```

Start the combined project with:

```bash
docker compose \
  -f compose.yml \
  -f vendor/multica/docker-compose.selfhost.yml \
  up -d
```

If service names or networks conflict, use a thin Multica override file rather than editing the vendor file.

## 6.2 Environment file

Create `.env` with permissions `0600`:

```bash
cp .env.example .env
chmod 600 .env
```

Minimum groups of secrets/configuration:

```dotenv
# Stack
COMPOSE_PROJECT_NAME=paos
TZ=America/New_York

# Memory DB
MEMORY_POSTGRES_USER=paos_memory
MEMORY_POSTGRES_DB=paos_memory
MEMORY_POSTGRES_PASSWORD=<random>

# Redis
REDIS_PASSWORD=<random>

# Bifrost
BIFROST_IMAGE=maximhq/bifrost:<PINNED_VERSION>
BIFROST_ADMIN_PASSWORD=<random>
BIFROST_ENCRYPTION_KEY=<random>
ZEN_API_KEY=<secret>

# Decision model
DECISION_MODEL=/models/kev-4b-q4_k_m.gguf
DECISION_API_KEY=<random>

# Privacy VPS
PRIVACY_BASE_URL=http://paos-private-gpu:8000/v1
PRIVACY_API_KEY=<random>
PRIVACY_MODEL=<selected-model-id>

# Grafana
GRAFANA_ADMIN_PASSWORD=<random>
```

Keep provider keys in Bifrost wherever possible rather than duplicating them across agents.

---

# 7. Docker Network Design

Use multiple bridge networks so accidental service-to-service reachability is limited.

```text
edge_net       Caddy ↔ Multica frontend/backend, Grafana
core_net       policy ↔ Bifrost ↔ decision ↔ Pi
memory_net     policy/Pi ↔ memory-db ↔ Redis
mcp_net        Bifrost/Pi ↔ MCP servers
obs_net        Prometheus/Grafana ↔ scrape targets
```

Recommended rules:

- `memory-db` and `redis` have **no published host ports**.
- `decision` has **no published host port** unless required for debugging.
- MCP servers have **no published host ports**; Bifrost is the gateway.
- Bifrost binds to loopback or an internal reverse-proxy path for the admin UI.
- Caddy is the only service intentionally exposed to the host/tailnet for browser traffic.

Example Compose skeleton:

```yaml
name: paos

services:
  memory-db:
    image: pgvector/pgvector:0.8.6-pg17
    environment:
      POSTGRES_USER: ${MEMORY_POSTGRES_USER}
      POSTGRES_PASSWORD: ${MEMORY_POSTGRES_PASSWORD}
      POSTGRES_DB: ${MEMORY_POSTGRES_DB}
    volumes:
      - memory_pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    networks: [memory_net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${MEMORY_POSTGRES_USER} -d ${MEMORY_POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    networks: [memory_net, core_net]
    restart: unless-stopped

  bifrost:
    image: ${BIFROST_IMAGE}
    environment:
      APP_HOST: 0.0.0.0
      APP_PORT: 8080
      LOG_LEVEL: info
      LOG_STYLE: json
    volumes:
      - /srv/paos/data/bifrost:/app/data
    networks: [core_net, mcp_net, obs_net]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "-O", "/dev/null", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  decision:
    image: ghcr.io/ggml-org/llama.cpp:server
    command:
      - -m
      - ${DECISION_MODEL}
      - --host
      - 0.0.0.0
      - --port
      - "8080"
      - --api-key
      - ${DECISION_API_KEY}
    volumes:
      - /srv/paos/data/models/decision:/models:ro
    networks: [core_net]
    restart: unless-stopped

  policy:
    build: ./policy
    env_file: .env
    depends_on:
      memory-db:
        condition: service_healthy
      bifrost:
        condition: service_healthy
    networks: [core_net, memory_net]
    restart: unless-stopped

  pi-runtime:
    build: ./pi
    env_file: .env
    volumes:
      - /srv/paos/data/pi/workspaces:/workspaces
    networks: [core_net, memory_net, mcp_net]
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:<PINNED_VERSION>
    volumes:
      - ./configs/prometheus:/etc/prometheus:ro
      - prometheus_data:/prometheus
    networks: [obs_net]
    restart: unless-stopped

  grafana:
    image: grafana/grafana:<PINNED_VERSION>
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    networks: [obs_net, edge_net]
    restart: unless-stopped

networks:
  edge_net: {}
  core_net: {}
  memory_net:
    internal: true
  mcp_net: {}
  obs_net: {}

volumes:
  memory_pgdata: {}
  redis_data: {}
  prometheus_data: {}
  grafana_data: {}
```

This is a **runbook skeleton**, not a drop-in final Compose file. Pin exact image versions during implementation and validate each service's current environment variables.

---

# 8. Multica Runbook

Multica's official self-host path already uses Docker Compose and includes frontend, backend, and PostgreSQL. Preserve that boundary instead of merging its schema into the PAOS memory database.

## 8.1 Install/pin Multica

```bash
cd /srv/paos/repo/vendor
git clone https://github.com/multica-ai/multica.git
cd multica
git fetch --tags --depth 1
git checkout $(git tag -l 'v*' --sort=-v:refname | head -1)
make selfhost
```

The official `make selfhost` creates `.env`, generates secrets, pulls images, creates persistent volumes, and waits for health checks on first run.

## 8.2 Health checks

```bash
cd /srv/paos/repo/vendor/multica
docker compose -f docker-compose.selfhost.yml ps
curl -fsS http://localhost:8080/readyz
```

Expected API readiness includes database and migration checks reporting `ok`.

## 8.3 Connect a runtime

On the machine that will execute Multica runs:

```bash
curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash
multica setup self-host \
  --server-url https://<multica-api-tailnet-name> \
  --app-url https://<multica-app-tailnet-name>
multica daemon status
```

For the pilot, the first runtime can be the control VM itself. Run its daemon under a dedicated Unix account because Multica runtimes execute with that user's permissions.

## 8.4 Common operations

```bash
# Status
docker compose -f docker-compose.selfhost.yml ps

# Logs
docker compose -f docker-compose.selfhost.yml logs -f backend

# Apply .env changes
docker compose -f docker-compose.selfhost.yml up -d

# Stop, preserving volumes
docker compose -f docker-compose.selfhost.yml down
```

Do **not** use `down -v` in routine operations.

## 8.5 Upgrade

1. Back up Multica Postgres.
2. Snapshot the VM as a secondary rollback point.
3. Pull repository changes and confirm image tag policy.
4. Pull images.
5. Recreate containers.
6. Watch backend migrations.
7. Re-run readiness checks.

Backup command from Multica's current self-host documentation:

```bash
docker compose -f docker-compose.selfhost.yml exec -T postgres \
  pg_dump -U multica multica > multica-backup.sql && gzip multica-backup.sql
```

---

# 9. Decision Model / llama.cpp Runbook

## 9.1 Purpose

The decision server does **classification, not routing**. It returns probabilities for bounded questions such as privacy, complexity, task type, tool intensity, and risk. The policy service converts those scores into deterministic actions.

## 9.2 Model file

Store GGUF files at:

```text
/srv/paos/data/models/decision/
```

Start with the selected Kev-class decision model. Record:

- Hugging Face repository
- exact filename
- SHA256
- quantization
- license
- date downloaded

Generate checksum:

```bash
sha256sum /srv/paos/data/models/decision/*.gguf
```

## 9.3 API verification

`llama-server` exposes `/v1/systemone` for decision models.

```bash
curl -sS http://decision:8080/v1/systemone \
  -H "Authorization: Bearer $DECISION_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "state":"Summarize these public papers and compare their methods.",
    "questions":{
      "privacy":{
        "type":"choice",
        "options":{
          "normal":"May use external model providers",
          "private":"Must use private inference"
        }
      },
      "complexity":{
        "type":"score",
        "levels":["small","balanced","deep"]
      }
    }
  }' | jq
```

The exact request schema should be tested against the pinned llama.cpp version before production use. Probabilities are model scores, not guaranteed calibrated probabilities, so tune thresholds against your own labeled pilot data.

## 9.4 Failure behavior

If the decision server is unavailable:

- **Do not default to cloud for unknown privacy.**
- Route the request to a safe holding state or require manual classification.
- Log `decision_unavailable`.

---

# 10. Policy Service Runbook

## 10.1 Responsibilities

The policy service must be deliberately boring. It should:

1. receive task metadata and sanitized prompt text;
2. call the decision model;
3. apply deterministic thresholds and deny/approval rules;
4. produce a route (`small`, `balanced`, `deep`, `privacy`);
5. attach allowed MCP/tool scopes;
6. attach approval requirements;
7. record the decision and scores;
8. call Bifrost or hand the task to Pi.

It must **not** silently reinterpret privacy policy with a generative LLM.

## 10.2 Example policy

```python
if decision_unavailable:
    return HOLD_FOR_REVIEW

if privacy_score >= PRIVATE_THRESHOLD:
    return route("privacy", external_providers=False)

if risk == "consequential":
    approval_required = True

if complexity_score < 1.5:
    route_name = "small"
elif complexity_score < 2.5:
    route_name = "balanced"
else:
    route_name = "deep"
```

## 10.3 Configuration

Keep policy values in version-controlled YAML, not hard-coded in the image:

```yaml
privacy:
  threshold: 0.75
  unknown_action: hold
  cloud_escalation: forbidden

complexity:
  small_max: 1.5
  balanced_max: 2.5

approval:
  consequential_actions: true
  filesystem_delete: true
  send_external_message: true
```

Every policy change should carry a Git commit and a `policy_version` recorded with each run.

---

# 11. Bifrost Runbook

## 11.1 Role

Bifrost is the single model and MCP gateway. Agents should request **capability aliases**, not provider-specific model IDs.

Initial aliases:

```text
small
balanced
deep
deep-tools
privacy
```

The concrete backing models can change without changing agents.

## 11.2 Persistence

Mount:

```text
/srv/paos/data/bifrost → /app/data
```

Bifrost currently stores configuration and logs under its app directory. Pin a Bifrost image version rather than using `latest` for the pilot.

## 11.3 Health

```bash
curl -fsS http://bifrost:8080/health
```

From inside the VM, test a cheap non-sensitive route:

```bash
curl -sS http://localhost:<BIFROST_LOCAL_PORT>/v1/chat/completions \
  -H "Authorization: Bearer <virtual-key>" \
  -H 'Content-Type: application/json' \
  -d '{
    "model":"small",
    "messages":[{"role":"user","content":"Reply with OK."}]
  }' | jq
```

## 11.4 MCP governance

Bifrost can connect to MCP servers over STDIO, HTTP, or SSE and can expose aggregated MCP tools through its own `/mcp` endpoint. Treat tool exposure as a privilege boundary.

Rules:

- register MCP servers centrally;
- disable tools that are not required;
- use per-agent/virtual-key tool allowlists;
- do not enable auto-execution for destructive tools;
- prefer read-only MCP identities where possible;
- log every tool call with agent/run identity.

## 11.5 Provider routing

Configure OpenCode Zen as the normal provider pool and the privacy VPS as a separate OpenAI-compatible provider.

Conceptually:

```text
small      → Zen cheap/fast tool-capable model
balanced   → Zen workhorse
 deep      → Zen premium reasoning/tool model
 deep-tools→ Zen coding/tool specialist
 privacy   → http://paos-private-gpu:8000/v1
```

For `privacy`, enforce provider allowlist = privacy endpoint only.

## 11.6 Bifrost outage

If Bifrost is down:

1. Pi agents stop new model work.
2. Multica remains available for human coordination.
3. Existing memory remains intact.
4. Do not bypass Bifrost by distributing provider keys to agents.
5. Restore Bifrost and replay only idempotent queued tasks.

---

# 12. Memory Store Runbook

## 12.1 Database

Use official `pgvector/pgvector` image with a pinned PostgreSQL version. Create the extension during initialization:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 12.2 Core schema

### `memory_items`

```sql
CREATE TABLE memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace text NOT NULL,
  project_id text,
  agent_id text,
  memory_type text NOT NULL,
  content text NOT NULL,
  summary text,
  source_type text,
  source_ref text,
  sensitivity text NOT NULL DEFAULT 'normal',
  confidence real,
  importance real,
  embedding_model text,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_id uuid REFERENCES memory_items(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  expires_at timestamptz
);
```

Do not freeze the vector dimension until the embedding model is selected. If the selected model uses another dimension, change `vector(1536)` before initial deployment.

### `memory_links`

```sql
CREATE TABLE memory_links (
  from_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  relation text NOT NULL,
  weight real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_id, to_id, relation)
);
```

### `runs`

```sql
CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multica_run_id text,
  project_id text,
  agent_id text,
  policy_version text NOT NULL,
  route text NOT NULL,
  requested_model_alias text,
  resolved_provider text,
  resolved_model text,
  privacy_class text,
  complexity_score real,
  decision_payload jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text,
  input_tokens bigint DEFAULT 0,
  output_tokens bigint DEFAULT 0,
  cached_tokens bigint DEFAULT 0,
  cost_usd numeric(12,6) DEFAULT 0,
  latency_ms bigint,
  tool_calls integer DEFAULT 0,
  escalations integer DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

### `run_events`

```sql
CREATE TABLE run_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

### `human_feedback`

```sql
CREATE TABLE human_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  corrected_route text,
  accepted boolean,
  correction text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `memory_access_log`

```sql
CREATE TABLE memory_access_log (
  id bigserial PRIMARY KEY,
  memory_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  access_type text NOT NULL,
  score real,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
```

## 12.3 Indexes

```sql
CREATE INDEX memory_items_namespace_idx ON memory_items(namespace);
CREATE INDEX memory_items_project_idx ON memory_items(project_id);
CREATE INDEX memory_items_type_idx ON memory_items(memory_type);
CREATE INDEX memory_items_metadata_gin ON memory_items USING gin(metadata);
CREATE INDEX runs_started_idx ON runs(started_at DESC);
CREATE INDEX runs_route_idx ON runs(route);
```

After enough vectors exist, add an HNSW index appropriate to the chosen distance metric:

```sql
CREATE INDEX memory_embedding_hnsw
ON memory_items
USING hnsw (embedding vector_cosine_ops);
```

## 12.4 Memory write policy

Do not write every transcript turn to durable memory.

A memory candidate should answer at least one of:

- Will this fact likely matter again?
- Did a project decision or state change?
- Is this a reusable preference/instruction?
- Did the human correct the system in a way that should alter future behavior?
- Is this a reusable artifact/insight with provenance?

Every memory should have provenance and sensitivity metadata.

## 12.5 Retrieval policy

Retrieve by:

1. hard namespace/project filters;
2. recency/status filters where relevant;
3. vector similarity;
4. optional reranking;
5. context budget.

Never allow a normal cloud route to retrieve memories marked `private` unless the policy layer explicitly redacts or blocks them.

---

# 13. Redis Runbook

Redis is **ephemeral coordination**, not long-term memory.

Use it for:

- queues;
- distributed locks;
- short-lived run state;
- rate-limit counters;
- cache entries;
- event fan-out.

Use AOF if queue recovery matters:

```text
--appendonly yes
```

Never treat Redis as the canonical record of a run or memory. Anything that must survive reconstruction belongs in Postgres or Multica.

Health:

```bash
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" PING
```

Expected: `PONG`.

---

# 14. Pi Agents / Execution Runtime

## 14.1 Principle

Do not build one omnipotent agent. Define role-specific agents with explicit directories, MCP scopes, and model aliases.

Suggested initial roles:

| Agent | Default model tier | Filesystem | Tools | Write scope |
|---|---|---|---|---|
| Research Scout | balanced | research workspace | web/search, papers, memory-read | notes only |
| Synthesizer | balanced/deep | project workspace | memory-read, sources | reports |
| Critic | deep | read-only project | memory-read | review output only |
| Builder | balanced/deep-tools | repository worktree | git, shell, tests | worktree |
| Personal Ops | small/balanced | none by default | calendar/email/home MCP as granted | action-specific |

## 14.2 Workspace isolation

Give each run a working directory:

```text
/srv/paos/data/pi/workspaces/<project>/<run-id>/
```

Prefer disposable Git worktrees for coding agents rather than giving them the canonical checkout.

## 14.3 Approval boundary

Require human approval before:

- destructive filesystem operations;
- sending messages externally;
- purchasing/submitting/booking;
- credential changes;
- merging/pushing to protected branches;
- changing networking/security policy;
- changing durable memory classified as authoritative.

---

# 15. MCP Service Runbook

Start with few MCP servers. Tool quantity creates attack surface and routing confusion.

Recommended pilot order:

1. filesystem/project read-only MCP
2. web/search MCP
3. Git/GitHub MCP
4. memory MCP backed by Postgres
5. shell/task MCP with allowlisted commands
6. calendar/email only after approval semantics are tested

For each MCP server document:

```text
name
purpose
container/image/version
transport (stdio/http/sse)
authentication
secrets used
network
allowed agents
read/write/destructive classification
health check
backup requirements
```

Bifrost supports STDIO, HTTP, and SSE MCP connections. Prefer HTTP for independently containerized services; prefer STDIO only when the tool is intentionally a child process of the gateway and its environment is tightly controlled.

---

# 16. GPU Privacy VPS Build

## 16.1 Provisioning target

Select the VPS after the privacy model benchmark. For a 20–30B quantized model, plan around a **24–48 GB GPU** depending on quantization and desired context. Favor 48 GB if the price difference is modest; VRAM headroom is operationally valuable.

Base host:

- Ubuntu 24.04 LTS/current supported LTS
- NVIDIA driver compatible with provider GPU
- Docker Engine
- NVIDIA Container Toolkit
- Tailscale
- no public inference port

## 16.2 Firewall

Use provider firewall plus host firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
sudo ufw enable
```

If provider console access is reliable, SSH can also be limited to Tailscale.

## 16.3 vLLM deployment

Use vLLM as the default privacy server on NVIDIA because it exposes an OpenAI-compatible API and has an official Docker image.

Directory:

```text
/srv/paos-private/
├── compose.yml
├── .env
└── cache/
```

Example:

```yaml
services:
  vllm:
    image: vllm/vllm-openai:<PINNED_VERSION>
    gpus: all
    ipc: host
    environment:
      HF_TOKEN: ${HF_TOKEN}
    volumes:
      - ./cache/huggingface:/root/.cache/huggingface
      - ./cache/vllm:/root/.cache/vllm
    command:
      - --model
      - ${PRIVACY_MODEL}
      - --api-key
      - ${PRIVACY_API_KEY}
      - --host
      - 0.0.0.0
      - --port
      - "8000"
      - --max-model-len
      - ${PRIVACY_MAX_MODEL_LEN:-32768}
    ports:
      - "127.0.0.1:8000:8000"
    restart: unless-stopped
```

Because `127.0.0.1` would not be reachable directly over Tailscale, use one of these patterns:

**Preferred:** host-level reverse proxy bound to the Tailscale IP, forwarding to `127.0.0.1:8000`.

**Alternative:** bind Docker port directly to the host's Tailscale IP:

```yaml
ports:
  - "<TAILSCALE_IP>:8000:8000"
```

Do not bind `0.0.0.0:8000` unless the provider firewall guarantees no public access and you have independently verified it.

## 16.4 Health checks

On VPS:

```bash
nvidia-smi
docker compose ps
curl -sS http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer $PRIVACY_API_KEY" | jq
```

From control VM:

```bash
curl -sS http://paos-private-gpu:8000/v1/models \
  -H "Authorization: Bearer $PRIVACY_API_KEY" | jq
```

## 16.5 Privacy-route behavior

If the VPS is down:

```text
private task → STOP / QUEUE / ASK HUMAN
```

Never:

```text
private task → privacy VPS fails → Zen fallback
```

That prohibition belongs in the policy service and Bifrost provider allowlist.

---

# 17. Reverse Proxy and User Access

For v0.1, keep services tailnet-only.

Recommended tailnet endpoints:

```text
https://multica.<tailnet-domain>
https://bifrost.<tailnet-domain>      # admin UI only
https://grafana.<tailnet-domain>
```

Caddy can proxy to container-local services. Multica's current self-host docs specifically recommend keeping its `3000` and `8080` Docker bindings on loopback and using a reverse proxy rather than switching them to public `0.0.0.0` bindings.

If TLS inside the tailnet is unnecessary for the first day, HTTP over Tailscale is acceptable for a lab bootstrap; converge on HTTPS before storing sensitive operational data in browser sessions.

---

# 18. Observability

## 18.1 What to measure

Minimum metrics:

**Infrastructure**
- container up/down
- CPU, RAM, disk
- Postgres connections/storage
- Redis memory/queue depth
- GPU utilization/VRAM on privacy VPS

**Model routing**
- route selected
- resolved provider/model
- token counts
- cached tokens
- cost
- latency
- failures/retries
- escalation count

**Tools**
- tool name
- requesting agent
- approval status
- duration
- success/error
- destructive/read-only class

**Human loop**
- acceptance
- correction
- route override
- rating
- time-to-completion

## 18.2 Dashboards

Start with four Grafana dashboards:

1. **System health**
2. **Model spend and latency**
3. **Routing quality**
4. **Agent/tool reliability**

The most useful long-term metric is not tokens/sec. It is:

```text
cost per successfully completed task
```

---

# 19. Startup and Shutdown

## 19.1 Normal startup order

1. Proxmox VM boots.
2. Tailscale becomes online.
3. Docker starts.
4. Databases/Redis start.
5. Decision server and Bifrost start.
6. Policy/Pi/MCP services start.
7. Multica starts and passes migrations.
8. Observability starts.
9. Optional privacy VPS is started if not always-on.
10. End-to-end smoke test.

With dependencies encoded in Compose health conditions, most of this happens automatically.

## 19.2 End-to-end smoke test

Run:

```bash
./scripts/smoke-test.sh
```

The script should verify:

- Multica `/readyz`
- Bifrost `/health`
- decision `/v1/systemone`
- Postgres query + `vector` extension
- Redis `PING`
- privacy VPS `/v1/models`
- one `small` test completion
- one `privacy` test completion with synthetic data
- Prometheus targets healthy

## 19.3 Normal shutdown

Before planned VM shutdown:

```bash
cd /srv/paos/repo
./scripts/backup.sh
docker compose stop
sudo shutdown -h now
```

Use `stop` or `down` without `-v`.

---

# 20. Backup Strategy

## 20.1 Backup classes

| Data | Method | Frequency | Retention |
|---|---|---|---|
| Memory Postgres | `pg_dump` custom format | nightly | 14 daily + 8 weekly |
| Multica Postgres | `pg_dump` | nightly and before upgrade | 14 daily + 8 weekly |
| Bifrost config/data | tar/rsync of bind mount | nightly | 14 daily |
| Policy/config repo | Git remote | on commit | Git history |
| Grafana dashboards | provisioning files + volume backup | weekly | 4–8 weeks |
| Decision model | checksum + source metadata | on change | no repeated backup needed if redownloadable |
| Pi workspaces | project-dependent | nightly for active work | 7–30 days |
| Privacy VPS model cache | normally redownloadable | none | n/a |

## 20.2 Database backup example

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /srv/paos/data/backups/$STAMP

docker compose exec -T memory-db \
  pg_dump -U "$MEMORY_POSTGRES_USER" -d "$MEMORY_POSTGRES_DB" -Fc \
  > "/srv/paos/data/backups/$STAMP/memory.dump"
```

Validate backups, don't merely create them:

```bash
pg_restore --list /srv/paos/data/backups/$STAMP/memory.dump >/dev/null
```

## 20.3 Off-host copy

At least one backup copy should leave the VM. Suitable targets:

- Proxmox Backup Server
- NAS
- encrypted object storage
- another trusted host over Tailscale

VM snapshots are not substitutes for application-aware database backups.

---

# 21. Upgrade Procedure

Never run blind `latest` upgrades on the whole stack.

For each service:

1. Read release notes.
2. Record current image/version.
3. Back up affected state.
4. Commit configuration changes.
5. Pull one service/image at a time where practical.
6. Recreate service.
7. Run service health check.
8. Run an end-to-end synthetic task.
9. Observe for errors/cost anomalies.
10. Proceed to next service.

Generic pattern:

```bash
docker compose pull <service>
docker compose up -d <service>
docker compose logs --tail=100 <service>
```

Pin versions in Compose after successful validation.

---

# 22. Incident Runbooks

## 22.1 Multica unavailable

Check:

```bash
docker compose -f vendor/multica/docker-compose.selfhost.yml ps
docker compose -f vendor/multica/docker-compose.selfhost.yml logs --tail=200 backend postgres
curl -v http://localhost:8080/readyz
```

If DB migration failed, do not repeatedly restart blindly. Preserve logs and database backup before repair.

## 22.2 Bifrost unavailable

```bash
docker compose ps bifrost
docker compose logs --tail=200 bifrost
curl -v http://localhost:<port>/health
```

Expected behavior: new inference work pauses. Do not hand provider keys directly to Pi agents as an emergency shortcut.

## 22.3 Decision server unavailable

```bash
docker compose ps decision
docker compose logs --tail=200 decision
```

Expected behavior: policy returns **hold/manual classification**, not cloud-default.

## 22.4 Memory DB unavailable

```bash
docker compose ps memory-db
docker compose logs --tail=200 memory-db
docker compose exec memory-db pg_isready
```

Pause durable memory writes. Agents may continue only if the task can safely operate without memory and the policy allows degraded mode.

## 22.5 Redis unavailable

Restart Redis after checking disk/AOF. Reconstruct durable state from Postgres; assume ephemeral jobs may need replay.

## 22.6 Privacy VPS unavailable

From control VM:

```bash
tailscale ping paos-private-gpu
curl -v http://paos-private-gpu:8000/v1/models
```

On VPS:

```bash
nvidia-smi
docker compose ps
docker compose logs --tail=200 vllm
```

Private jobs remain queued/held until recovery or explicit human reclassification.

## 22.7 GPU out of memory

Symptoms: vLLM process exits, CUDA OOM, health endpoint disappears.

Recovery options, in order:

1. reduce maximum model context;
2. reduce concurrent requests;
3. use a more compact quantization supported by the runtime/model;
4. select a smaller privacy model;
5. move to more VRAM.

Do not silently truncate user context without recording that degradation.

## 22.8 Provider spend spike

1. Disable affected Bifrost route/virtual key.
2. Inspect recent runs grouped by agent/model/tool loop.
3. Check for retry storms or runaway agents.
4. Confirm Zen/provider spend limits.
5. Re-enable only after cause is understood.

---

# 23. Security Checklist

## Host

- [ ] SSH keys only; disable password SSH where possible.
- [ ] OS unattended security updates enabled or scheduled.
- [ ] UFW/default-deny inbound.
- [ ] Tailscale tagged identities for servers.
- [ ] No public Postgres/Redis/Bifrost/llama/vLLM ports.

## Docker

- [ ] Image versions pinned.
- [ ] Databases have no published ports.
- [ ] Secrets excluded from Git.
- [ ] Containers run with least privilege where supported.
- [ ] Read-only mounts used for configs/models where possible.
- [ ] No Docker socket mounted into agents unless explicitly required and heavily constrained.

## AI/tool layer

- [ ] Private route has no external provider fallback.
- [ ] Destructive MCP tools require approval.
- [ ] Per-agent tool allowlists exist.
- [ ] Provider credentials terminate at Bifrost where practical.
- [ ] Decision failures fail closed for privacy.
- [ ] Memory retrieval respects sensitivity labels.

## Data

- [ ] Postgres dumps tested.
- [ ] Off-host backup exists.
- [ ] Backup encryption configured.
- [ ] Memory provenance recorded.
- [ ] Retention/deletion policy documented.

---

# 24. Routine Operating Cadence

## Daily / automatic

- health checks
- nightly database backups
- disk-space alerting
- model spend/budget thresholds
- container restart alerts

## Weekly

```text
Review failed agent runs
Review provider spend
Review private-route failures
Check backup completion + one restore sample
Check disk usage
Review new MCP/tool registrations
```

## Monthly

```text
Patch Ubuntu/Docker host
Review container release notes
Rotate or audit stale credentials
Review Tailscale devices/tags
Review memory growth and stale namespaces
Evaluate routing success by tier/model
Review cost per successful task
```

## Quarterly

- restore the stack into a test VM from backups;
- test privacy VPS rebuild from scratch;
- re-benchmark Small/Balanced/Deep aliases;
- re-label a sample of decision-model classifications;
- adjust policy thresholds only from evidence;
- review whether any MCP privilege can be removed.

---

# 25. Build Order for v0.1

Use this order. Each phase ends with a functioning checkpoint.

## Phase 1 — Host and network

1. Create Ubuntu VM.
2. Patch OS and create `paos` user.
3. Install Docker.
4. Install Tailscale on VM/admin workstation.
5. Apply Tailscale Grants.
6. Create `/srv/paos` layout.

**Checkpoint:** admin workstation can SSH to VM over Tailscale; no application services yet.

## Phase 2 — State services

1. Deploy memory Postgres/pgvector.
2. Run schema migrations.
3. Deploy Redis.
4. Test DB backup and restore.

**Checkpoint:** memory DB and Redis healthy, not exposed publicly.

## Phase 3 — Decision and policy

1. Download/checksum decision GGUF.
2. Deploy llama.cpp server.
3. Validate `/v1/systemone`.
4. Deploy policy service.
5. Test privacy fail-closed behavior.

**Checkpoint:** sample prompts classify and produce deterministic routes.

## Phase 4 — Bifrost and Zen

1. Deploy Bifrost.
2. Configure authentication.
3. Add OpenCode Zen provider/key.
4. Define Small/Balanced/Deep aliases.
5. Set budgets/virtual keys.
6. Test tool calling with a harmless MCP.

**Checkpoint:** one normal request routes through Bifrost to each tier.

## Phase 5 — Privacy VPS

1. Provision GPU VPS.
2. Harden OS/firewall.
3. Install Docker/NVIDIA/Tailscale.
4. Deploy vLLM.
5. Add privacy endpoint to Bifrost.
6. Verify only control VM can reach port 8000.
7. Test fail-closed behavior by intentionally stopping vLLM.

**Checkpoint:** synthetic private request succeeds; outage never falls back to Zen.

## Phase 6 — Multica

1. Pin official Multica release.
2. Run official self-host Compose.
3. Configure tailnet reverse proxy.
4. Create workspace.
5. Connect control-VM runtime.
6. Create first research agent.

**Checkpoint:** Multica issue creates a run and receives a completed response.

## Phase 7 — Pi + MCP

1. Deploy Pi runtime.
2. Create scoped agent roles.
3. Add memory MCP.
4. Add read-only filesystem MCP.
5. Add web/search.
6. Add Git tooling last.

**Checkpoint:** bounded research workflow completes and writes only to its allowed workspace.

## Phase 8 — Observability and feedback

1. Deploy Prometheus/Grafana.
2. Build four baseline dashboards.
3. Populate `runs`, `run_events`, and `human_feedback`.
4. Record model alias resolution and cost.

**Checkpoint:** every task can be traced from Multica → decision → route → model → tools → outcome → feedback.

---

# 26. Go-Live Acceptance Test

Do not call the pilot ready until all are true:

- [ ] Control VM can be rebuilt from documented steps.
- [ ] All persistent volumes are identified.
- [ ] Memory DB restore tested.
- [ ] Multica DB restore tested.
- [ ] No database is publicly reachable.
- [ ] Bifrost provider keys are not present in Pi agent configs.
- [ ] Decision outage fails closed.
- [ ] Private inference outage fails closed.
- [ ] Normal Small/Balanced/Deep routes work.
- [ ] Privacy route works over Tailscale.
- [ ] MCP allowlists differ by agent role.
- [ ] Destructive tool action requires approval.
- [ ] Model/tool costs appear in telemetry.
- [ ] Human feedback can be recorded against a run.
- [ ] Nightly backup runs automatically.
- [ ] Grafana shows service health and spend.

---

# 27. Quick Reference

## Control VM

```bash
cd /srv/paos/repo

docker compose ps
docker compose logs -f --tail=100
docker compose pull <service>
docker compose up -d <service>
docker compose stop
docker system df

tailscale status
sudo ufw status verbose
```

## Memory DB

```bash
docker compose exec memory-db pg_isready
docker compose exec memory-db psql -U "$MEMORY_POSTGRES_USER" -d "$MEMORY_POSTGRES_DB"
```

## Redis

```bash
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" PING
```

## Bifrost

```bash
curl -fsS http://localhost:<port>/health
```

## Multica

```bash
cd /srv/paos/repo/vendor/multica
docker compose -f docker-compose.selfhost.yml ps
curl -fsS http://localhost:8080/readyz
multica daemon status
```

## Privacy VPS

```bash
nvidia-smi
docker compose ps
docker compose logs -f --tail=100 vllm
curl -sS http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer $PRIVACY_API_KEY"
```

---

# 28. Configuration Registry

Maintain this table in the repository (without secrets):

| Item | Value |
|---|---|
| Control VM hostname | `paos-control` |
| Control VM OS |  |
| Control VM vCPU/RAM |  |
| Tailnet name |  |
| Multica version |  |
| Bifrost version |  |
| llama.cpp image/version |  |
| Decision model + SHA256 |  |
| PostgreSQL version |  |
| pgvector version |  |
| Redis version |  |
| Pi version |  |
| Privacy VPS provider/instance |  |
| GPU model/VRAM |  |
| vLLM version |  |
| Privacy model |  |
| Small alias model |  |
| Balanced alias model |  |
| Deep alias model |  |
| Backup target |  |
| Last restore test |  |

---

# 29. Sources and Version-Sensitive Notes

This runbook intentionally distinguishes architecture from version-sensitive commands. Validate commands when pinning software versions.

1. **Multica self-host quickstart** — Docker Compose deployment, health checks, runtime setup, backup and upgrade behavior: https://multica.ai/docs/self-host-quickstart
2. **Multica environment variables** — production-facing configuration: https://multica.ai/docs/environment-variables
3. **Multica daemon/runtimes** — execution boundary and runtime permissions: https://multica.ai/docs/daemon-runtimes
4. **Bifrost gateway setup** — Docker image, persistent app directory, health/API model: https://github.com/maximhq/bifrost/blob/dev/docs/quickstart/gateway/setting-up.mdx
5. **Bifrost MCP** — STDIO/HTTP/SSE connections and tool governance: https://github.com/maximhq/bifrost/blob/dev/docs/mcp/connecting-to-servers.mdx
6. **llama.cpp server** — `/v1/systemone` decision-model endpoint and Docker server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
7. **pgvector** — official Docker image and extension management: https://github.com/pgvector/pgvector
8. **Tailscale Grants** — recommended deny-by-default access-control model for new deployments: https://tailscale.com/docs/features/access-control/grants
9. **vLLM Docker** — official OpenAI-compatible GPU server image: https://docs.vllm.ai/en/stable/deployment/docker/

---

# Appendix A — Recommended `.gitignore`

```gitignore
.env
.env.*
!.env.example
*.key
*.pem
*.crt
secrets/
backups/
data/
*.gguf
*.log
__pycache__/
.venv/
```

# Appendix B — Suggested Backup Script Shape

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="/srv/paos/data/backups/$STAMP"
mkdir -p "$DEST"

# Memory DB
docker compose exec -T memory-db \
  pg_dump -U "$MEMORY_POSTGRES_USER" -d "$MEMORY_POSTGRES_DB" -Fc \
  > "$DEST/memory.dump"

# Bifrost config/data
tar -C /srv/paos/data -czf "$DEST/bifrost.tgz" bifrost

# Config snapshot, excluding secrets
git -C /srv/paos/repo rev-parse HEAD > "$DEST/git-commit.txt"

# Validate database archive
pg_restore --list "$DEST/memory.dump" >/dev/null

echo "Backup complete: $DEST"
```

Add Multica's own Postgres dump using its official Compose service and copy the completed backup directory off-host.

# Appendix C — First Pilot Experiments

Once the system is stable, run a controlled set of tasks and record outcomes:

1. **Simple extraction** — should remain Small.
2. **Multi-source research** — should route Balanced.
3. **Complex synthesis/critique** — should escalate Deep.
4. **Synthetic sensitive prompt** — must route Privacy.
5. **Decision model offline** — must hold/manual classify.
6. **Privacy VPS offline** — must hold/queue, never Zen fallback.
7. **Tool error** — agent should recover or escalate, not loop indefinitely.
8. **Destructive MCP action** — must require approval.
9. **Memory retrieval** — project memories appear; unrelated/private namespaces do not.
10. **Human correction** — corrected route and feedback are stored for later analysis.
