**Personal Agentic OS**

A Human-Governed, Model-Routed, Tool-Capable Architecture for Personal
AI

**White Paper and Pilot Implementation Specification**

*Version 0.1 • October 2026*

**Design premise**

> *Keep human judgment and policy local, route ordinary cognition
> elastically, constrain delegated agents by explicit capabilities, and
> preserve durable context without surrendering control of the system.*

# Executive Summary

Personal AI is rapidly moving from a chat interface toward an operating
environment in which multiple models, tools, agents, memories, and
automated workflows cooperate around an individual's goals. The central
design problem is no longer simply which model to use. It is how to
coordinate many models and actions while preserving human control,
privacy boundaries, traceability, affordability, and the ability to
learn from experience.

This white paper proposes a pilot Personal Agentic OS built around five
components: Multica as the human control and reporting surface; a
locally hosted llama.cpp decision model as the first-pass classifier;
Bifrost as the model and tool gateway; Pi-based agents as bounded
execution workers; and PostgreSQL with pgvector as a simple, inspectable
memory substrate. Normal workloads use elastic pay-as-you-go models
through OpenCode Zen or other providers behind Bifrost. Sensitive
workloads are routed to a dedicated GPU VPS running a privately
controlled model endpoint.

The first implementation deliberately favors a single Ubuntu VM on
Proxmox running Docker Compose. This reduces operational complexity
while preserving clean logical boundaries. Tailscale links the home
control plane and the GPU VPS without exposing internal services to the
public Internet. The architecture is designed so that each logical
component can later be separated into LXCs, VMs, or independent hosts
without redesigning the system.

The core research idea is a feedback loop: every task is classified,
routed, executed, observed, evaluated, and selectively written to
memory. Over time, empirical records of cost, latency, tool-use
reliability, escalation, and human corrections can improve routing
policy without requiring model fine-tuning. The result is a system that
aims to allocate the least expensive sufficient intelligence while
keeping humans responsible for consequential decisions.

# 1. Problem Statement: What Is Missing from Personal AI

Today's personal AI tools are powerful but fragmented. Chat interfaces
have weak continuity across projects; agent frameworks often emphasize
autonomy more than governance; model gateways optimize provider access
without understanding human goals; and memory systems frequently
accumulate context without clear provenance, scope, or deletion
semantics. A useful personal agentic system must join these pieces
without turning one person's workflow into a miniature cloud platform.

## 1.1 Gaps the pilot aims to close

| **Gap**                   | **Why it matters**                                                                                                                                     | **Pilot response**                                                          |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Human governance          | Most agent runtimes are execution-centric. The user needs one place to create goals, approve work, inspect progress, intervene, and request follow-up. | Multica workspace, issues, comments, run history, approvals.                |
| Model overuse             | A frontier model is often invoked even when a cheap model or deterministic rule would suffice.                                                         | Decision model + policy engine + model tiers.                               |
| Provider lock-in          | Agents frequently know provider-specific model names and credentials.                                                                                  | Bifrost aliases, routing, fallbacks, tracking, budgets.                     |
| Tool sprawl               | Each agent can become a bespoke bundle of credentials and integrations.                                                                                | MCP gateway plus per-agent tool scopes and approvals.                       |
| Weak trust boundaries     | Privacy is commonly treated as a model-selection preference rather than a routing constraint.                                                          | Privacy classification before external routing; dedicated private endpoint. |
| Memory without discipline | Embedding every transcript creates noise, privacy risk, and weak provenance.                                                                           | Selective typed memories in PostgreSQL + pgvector.                          |
| No learning from outcomes | Routing choices are rarely evaluated against task success, cost, latency, or human correction.                                                         | Run telemetry + feedback tables + policy analytics.                         |
| Operational complexity    | Self-hosting every model and service produces GPU and orchestration overhead.                                                                          | Single Compose control plane + elastic cloud cognition + one privacy VPS.   |

## 1.2 Design goals

- Human agency first: agents propose, execute within scope, report, and
  escalate. Consequential actions remain subject to explicit policy or
  approval.

- Least-cost sufficient intelligence: start cheap and escalate based on
  task complexity, uncertainty, tool intensity, or failure.

- Privacy before inference: classification and policy happen before
  non-sensitive content is sent to external model providers.

- Inspectable state: prompts, routes, tool calls, costs, outcomes, and
  durable memories should be auditable.

- Bounded agency: each Pi agent receives only the tools, credentials,
  directories, and memory namespaces required for its role.

- Composable infrastructure: one VM for the pilot, but component
  boundaries should survive migration to separate hosts.

- Simple memory first: use relational data plus vector search before
  adopting a specialized memory framework.

- Feedback-driven improvement: optimize cost per successful completed
  task, not benchmark scores or token price alone.

# 2. System Architecture

The pilot separates five logical planes while allowing most of them to
coexist inside one Docker Compose deployment.

HUMAN  
│  
▼  
┌─────────────────────────┐  
│ MULTICA │  
│ goals • issues • review │  
│ approvals • follow-up │  
└────────────┬────────────┘  
│ task/run  
▼  
┌─────────────────────────┐  
│ LOCAL DECISION MODEL │  
│ llama.cpp / SystemOne │  
│ privacy • complexity │  
│ type • tool intensity │  
└────────────┬────────────┘  
│ probabilities  
▼  
┌─────────────────────────┐  
│ POLICY SERVICE │  
│ deterministic rules │  
│ approvals • tier choice │  
└────────────┬────────────┘  
│ route  
▼  
┌─────────────────────────┐  
│ BIFROST │  
│ providers • aliases │  
│ MCP • budgets • traces │  
└──────┬───────────┬──────┘  
│ │  
normal │ │ sensitive  
▼ ▼  
OpenCode Zen GPU VPS  
small/bal/deep private model  
│ │  
└─────┬─────┘  
▼  
┌─────────────────────────┐  
│ PI AGENTS │  
│ scoped execution │  
│ tools • files • shell │  
└────────────┬────────────┘  
│  
┌───────────┴──────────┐  
▼ ▼  
MCP / external tools PostgreSQL + pgvector  
memory  
│ │  
└───────────┬──────────┘  
▼  
MULTICA  
result + follow-up

## 2.1 Component responsibilities

| **Component**  | **Primary responsibility**                                                                                     | **Should not own**                                                                |
|----------------|----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| Multica        | Human-facing projects, issues, agent identities, run/report history, intervention and follow-up.               | Provider credentials as a general secret store; raw private-model infrastructure. |
| Decision model | Fast local scoring of privacy, complexity, task type, tool intensity, and other bounded choices.               | Final routing policy or unconstrained generation.                                 |
| Policy service | Converts scores plus rules into route, model tier, tool scope, and approval requirements.                      | Natural-language reasoning that can silently change policy.                       |
| Bifrost        | Unified model endpoint, provider routing, fallbacks, MCP aggregation, usage/budget tracking and observability. | Human project management or long-term semantic memory.                            |
| Pi agents      | Execute bounded multi-step work in a working directory using explicitly delegated tools and scopes.            | Global credentials or unrestricted access by default.                             |
| Memory store   | Durable, typed, scoped context and retrieval with provenance.                                                  | Unfiltered transcript hoarding.                                                   |
| GPU VPS        | Serve private-model inference over a narrow authenticated network endpoint.                                    | General control-plane services, full memory database, or broad MCP access.        |

# 3. Model Selection and Routing

The system treats Small, Balanced, Deep, and Privacy as capability
classes rather than hard-coded model identities. Bifrost aliases allow
models to be changed without rewriting agents.

| **Route** | **Purpose**                                                                | **Initial candidate strategy**                                                              | **Escalation**                                                                     |
|-----------|----------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| small     | Routine extraction, summarization, simple tool use, short workflows.       | Cheap Zen model with demonstrated tool reliability.                                         | Low confidence, repeated tool error, or higher complexity → balanced.              |
| balanced  | Default serious work: research loops, coding, multi-step tools, synthesis. | DeepSeek/Qwen/GLM-class Zen workhorse selected from observed completion quality and cost.   | Ambiguity, repeated failure, high-value synthesis → deep.                          |
| deep      | Difficult reasoning, long planning, cross-checking, critical synthesis.    | Premium Zen frontier model; specialist alias for tool-heavy coding if useful.               | Human intervention or specialist route.                                            |
| privacy   | Content classified as not permitted for external LLM providers.            | Dedicated VPS model endpoint, e.g. Qwen 27B-class or GPT-OSS depending hardware/benchmarks. | Never auto-escalate to external provider; require explicit human choice/redaction. |

Decision models are suitable for the first pass because llama.cpp now
exposes a /v1/systemone endpoint that scores explicit options and
returns probabilities in a single forward pass rather than generating
free-form text \[3\].

Example classification dimensions  
  
privacy: normal \| private \| highly_sensitive  
complexity: small \| balanced \| deep  
task_type: research \| coding \| writing \| analysis \| planning \|
tool_operation  
tool_intensity: none \| simple \| multi_step \| long_running  
risk: reversible \| consequential  
  
Policy examples  
  
IF privacy \>= private_threshold → route = privacy  
ELIF risk == consequential → approval_required = true  
ELIF complexity == small → route = small  
ELIF complexity == balanced → route = balanced  
ELSE → route = deep  
  
IF decision confidence \< threshold → route one tier higher  
IF privacy route fails → stop and ask; never cloud-escalate
automatically

# 4. Agent Model: Multica + Pi

Multica and Pi serve different layers. Multica defines the human-facing
collaborator and preserves the work record; Pi provides the bounded
execution worker. Multica documents agents as reusable
identity/configuration bound to runtimes and records progress/results
back into issues, while its runtime executes on a connected computer
\[1\]\[2\]. Pi is an extensible terminal agent that can inspect files,
run commands, edit content, and work through multi-step tasks using a
selected model or compatible endpoint \[4\].

| **Multica agent**     | **Possible Pi execution role** | **Delegated capabilities**                                                                 |
|-----------------------|--------------------------------|--------------------------------------------------------------------------------------------|
| Research Collaborator | Scout → Reader → Synthesizer   | Web/paper search, read project memory, write research notes; no system administration.     |
| Builder               | Planner → Implementer → Tester | Repository worktree, git, constrained shell, test commands, issue updates.                 |
| Critic                | Independent reviewer           | Read-only project files, sources, memory; no write except review report.                   |
| Personal Ops          | Task-specific worker           | Calendar/email/home tools only when explicitly granted; separate namespaces and approvals. |

# 5. Pilot Deployment Topology

## 5.1 Proxmox VM: durable control and state plane

| **VM parameter** | **Pilot recommendation**                         | **Notes**                                                                             |
|------------------|--------------------------------------------------|---------------------------------------------------------------------------------------|
| Guest OS         | Ubuntu Server 24.04 LTS or current supported LTS | Stable Docker host; minimal packages.                                                 |
| vCPU             | 8–12 vCPU                                        | Decision model, DB, multiple service containers, Pi jobs.                             |
| RAM              | 24–32 GB                                         | Allows Kev-class decision model, PostgreSQL cache, Multica/Bifrost, MCPs, and growth. |
| Disk             | 150–250 GB SSD-backed virtual disk               | DB, images, logs, model file, backups; separate Proxmox backup target recommended.    |
| NIC              | VirtIO on trusted LAN/VLAN                       | No public inbound ports required if accessed via Tailscale.                           |
| Snapshots        | Before stack upgrades                            | Do not substitute VM snapshots for DB-aware backups.                                  |
| GPU              | Not required                                     | Decision model intended for CPU-first pilot; privacy inference lives on VPS.          |

## 5.2 GPU VPS: private inference enclave

| **Property**     | **Recommendation**                                                                                       |
|------------------|----------------------------------------------------------------------------------------------------------|
| Role             | OpenAI-compatible private model endpoint only.                                                           |
| GPU              | Choose by model/quantization; target enough VRAM for selected 20–30B privacy model and required context. |
| Networking       | Tailscale only; firewall public inference port closed.                                                   |
| Authentication   | Bifrost-to-endpoint secret plus Tailscale ACL/tag restrictions.                                          |
| Persistent data  | Model weights/cache and minimal logs only.                                                               |
| No replicas of   | Memory DB, general MCP credentials, Multica database, user documents.                                    |
| Operational mode | Start/stop if provider supports it; otherwise select monthly instance based on expected utilization.     |

## 5.3 Trust zones

ZONE A — HOME CONTROL PLANE (trusted)  
Proxmox VM: Multica, policy, decision model, Bifrost, Pi, memory, MCP
gateway  
  
ZONE B — PRIVATE INFERENCE VPS (restricted cloud)  
Private model server only; receives only the prompt/context required for
the private task  
  
ZONE C — EXTERNAL MODEL PROVIDERS  
OpenCode Zen / upstream providers; receives only tasks policy marks as
normal  
  
ZONE D — EXTERNAL TOOLS  
Web, GitHub, email, calendar, databases, etc.; permissions are
capability-scoped per agent

# 6. Docker Compose Structure

The first pilot should use one Compose project rather than separate
LXCs. The following is the target service topology; exact image names
and Multica self-host packaging should be verified at implementation
time because these projects are evolving quickly.

personal-agentic-os/  
├── compose.yml  
├── .env.example  
├── config/  
│ ├── bifrost/  
│ ├── policy/  
│ ├── multica/  
│ └── mcp/  
├── db/  
│ ├── init/  
│ └── migrations/  
├── decision/  
│ ├── models/  
│ └── config/  
├── agents/  
│ ├── AGENTS.md  
│ ├── skills/  
│ └── workspaces/  
├── mcp/  
│ ├── filesystem/  
│ ├── git/  
│ ├── web/  
│ └── custom/  
├── backups/  
├── observability/  
└── scripts/

## 6.1 Compose service graph

| **Service** | **Depends on**                  | **Persistent volume**    | **Network exposure**                 |
|-------------|---------------------------------|--------------------------|--------------------------------------|
| postgres    | —                               | pg_data                  | memory_net only                      |
| redis       | —                               | redis_data optional      | control_net only                     |
| multica     | postgres, redis                 | multica_data if required | edge_net + control_net               |
| decision    | —                               | decision_models          | control_net only                     |
| policy      | decision, postgres              | policy_config            | control_net only                     |
| bifrost     | policy (logical), MCP endpoints | bifrost_data             | control_net + egress_net             |
| pi-runtime  | bifrost, postgres               | pi_state, workspaces     | agent_net + control_net              |
| mcp-\*      | varies                          | service-specific         | mcp_net; no edge exposure by default |
| prometheus  | services                        | prometheus_data          | obs_net                              |
| grafana     | prometheus                      | grafana_data             | edge_net + obs_net                   |
| tailscale   | host/sidecar pattern            | tailscale_state          | edge bridge / host integration       |

## 6.2 Compose skeleton

services:  
postgres:  
image: pgvector/pgvector:pg17  
restart: unless-stopped  
env_file: .env  
volumes:  
- pg_data:/var/lib/postgresql/data  
- ./db/init:/docker-entrypoint-initdb.d:ro  
networks: \[memory_net\]  
  
redis:  
image: redis:7-alpine  
restart: unless-stopped  
command: \["redis-server", "--appendonly", "yes"\]  
volumes: \["redis_data:/data"\]  
networks: \[control_net\]  
  
decision:  
\# Build/pin llama.cpp server version used for SystemOne support.  
build: ./decision  
restart: unless-stopped  
volumes:  
- decision_models:/models:ro  
networks: \[control_net\]  
expose: \["8081"\]  
  
policy:  
build: ./policy  
restart: unless-stopped  
env_file: .env  
depends_on: \[decision, postgres\]  
networks: \[control_net, memory_net\]  
expose: \["8090"\]  
  
bifrost:  
image: maximhq/bifrost:latest \# pin exact tested tag in production  
restart: unless-stopped  
env_file: .env  
volumes:  
- bifrost_data:/app/data  
- ./config/bifrost:/config:ro  
networks: \[control_net, mcp_net, egress_net\]  
expose: \["8080"\]  
  
pi-runtime:  
build: ./agents  
restart: unless-stopped  
env_file: .env  
volumes:  
- pi_state:/home/agent/.pi  
- ./agents/workspaces:/workspaces  
- ./agents/skills:/skills:ro  
networks: \[control_net, mcp_net, memory_net, egress_net\]  
  
\# Multica self-host services inserted here according to the  
\# current upstream deployment manifest; connect only to the  
\# networks/databases they actually require.  
  
networks:  
edge_net: {}  
control_net: { internal: true }  
memory_net: { internal: true }  
mcp_net: { internal: true }  
egress_net: {}  
  
volumes:  
pg_data: {}  
redis_data: {}  
bifrost_data: {}  
decision_models: {}  
pi_state: {}

Bifrost stores configuration and request logs in its application
directory when run in Docker, so its mounted app directory should be
persistent \[7\]. Pin exact image versions after the pilot stabilizes
rather than relying on latest tags.

# 7. Docker Networking and Tailscale

Tailscale should provide host-to-host reachability, while Docker
networks constrain service-to-service reachability on the VM. Tailscale
documents both Docker connectivity and Serve for exposing a local
service only to the tailnet without public Internet exposure \[5\]\[6\].

| **Network** | **Members**                                     | **Purpose**                                                                         |
|-------------|-------------------------------------------------|-------------------------------------------------------------------------------------|
| edge_net    | Multica UI/API, Grafana, optional reverse proxy | Services intentionally reachable from the VM/Tailscale host.                        |
| control_net | Multica backend, policy, decision, Bifrost, Pi  | Internal orchestration APIs.                                                        |
| memory_net  | Postgres, policy, Pi, memory worker             | Database access; Bifrost does not need direct DB access unless explicitly required. |
| mcp_net     | Bifrost, Pi, MCP servers                        | Tool discovery/execution.                                                           |
| egress_net  | Bifrost, Pi, selected MCPs                      | Outbound Internet/API access only.                                                  |
| obs_net     | Prometheus, Grafana, exporters                  | Metrics and telemetry.                                                              |

## 7.1 Tailscale policy

- Install Tailscale on the Proxmox VM host/guest and on the GPU VPS.
  Prefer host-level Tailscale for the pilot unless a container must have
  an independent tailnet identity.

- Give the Proxmox VM and privacy VPS stable tags such as
  tag:agent-control and tag:privacy-inference.

- ACLs should permit Bifrost/policy traffic from the control VM to the
  VPS inference port, but not permit the VPS to initiate arbitrary
  connections back into the home LAN.

- Use Tailscale Serve only for tailnet-facing HTTPS convenience; do not
  use Funnel unless a workflow explicitly requires public ingress.

- Keep PostgreSQL, Redis, llama.cpp decision, and MCP services unbound
  to 0.0.0.0/public interfaces. Expose only through Docker networks or
  loopback/Tailscale as required.

# 8. Memory Architecture

The memory layer should remain deliberately simple: PostgreSQL is the
system of record and pgvector adds semantic retrieval alongside normal
relational filtering. pgvector stores vectors in PostgreSQL and supports
exact and approximate nearest-neighbor search, including HNSW and
IVFFlat indexes \[9\].

## 8.1 Memory types

| **Type**        | **Lifetime**          | **Examples**                                                        | **Write policy**                                             |
|-----------------|-----------------------|---------------------------------------------------------------------|--------------------------------------------------------------|
| working         | minutes to days       | Current task state, open questions, intermediate summaries.         | TTL or explicit run completion cleanup.                      |
| project         | weeks to years        | Decisions, terminology, research findings, architecture choices.    | Write only selected durable facts/decisions with provenance. |
| personal/global | long-lived            | Stable preferences, recurring workflows, reusable constraints.      | Higher confidence threshold; user-editable.                  |
| episodic/run    | retained selectively  | What route/model/tools were used and whether the outcome succeeded. | Automatic telemetry with bounded retention.                  |
| artifact index  | while artifact exists | Document chunks, repo summaries, notes, source metadata.            | Derived from source; delete/rebuild with source lifecycle.   |

## 8.2 Proposed tables

| **Table**         | **Purpose**                            | **Key fields**                                                                                |
|-------------------|----------------------------------------|-----------------------------------------------------------------------------------------------|
| memory_items      | Typed durable memories.                | id, namespace_id, kind, content, embedding, confidence, provenance, supersedes_id, timestamps |
| memory_namespaces | Scope boundaries.                      | id, type, owner, project_id, retention_policy                                                 |
| sources           | Provenance for memories/artifacts.     | id, uri, source_type, checksum, created_at, sensitivity                                       |
| artifacts         | Documents/files/repos known to system. | id, source_id, title, mime_type, metadata, sensitivity                                        |
| artifact_chunks   | Retrievable chunks.                    | id, artifact_id, ordinal, content, embedding, token_count                                     |
| runs              | Cross-system run record.               | id, multica_run_id, agent_id, route, model, start/end, status                                 |
| decisions         | Decision-model outputs.                | run_id, dimension, choice, probability, raw_scores, model_version                             |
| tool_events       | Tool/MCP execution telemetry.          | run_id, tool_name, operation, approval, latency, outcome, error_class                         |
| model_events      | Inference accounting.                  | run_id, provider, model, input/output/cache tokens, cost, latency, error                      |
| human_feedback    | Explicit corrections/evaluations.      | run_id, rating, correction_type, comment, created_at                                          |
| policy_versions   | Routing policy provenance.             | id, version, config_hash, active_from, notes                                                  |

## 8.3 Initial SQL schema

CREATE EXTENSION IF NOT EXISTS vector;  
CREATE EXTENSION IF NOT EXISTS pgcrypto;  
  
CREATE TABLE memory_namespaces (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
name text NOT NULL,  
namespace_type text NOT NULL CHECK (namespace_type IN
('working','project','personal','artifact')),  
project_key text,  
retention_days integer,  
created_at timestamptz NOT NULL DEFAULT now(),  
UNIQUE(name, project_key)  
);  
  
CREATE TABLE sources (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
uri text,  
source_type text NOT NULL,  
checksum text,  
sensitivity text NOT NULL DEFAULT 'normal',  
metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE memory_items (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
namespace_id uuid NOT NULL REFERENCES memory_namespaces(id) ON DELETE
CASCADE,  
source_id uuid REFERENCES sources(id) ON DELETE SET NULL,  
kind text NOT NULL,  
content text NOT NULL,  
embedding vector(1024), -- match selected embedding model  
confidence real CHECK (confidence \>= 0 AND confidence \<= 1),  
sensitivity text NOT NULL DEFAULT 'normal',  
provenance jsonb NOT NULL DEFAULT '{}'::jsonb,  
metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  
supersedes_id uuid REFERENCES memory_items(id),  
created_at timestamptz NOT NULL DEFAULT now(),  
last_used_at timestamptz,  
expires_at timestamptz  
);  
  
CREATE INDEX memory_items_namespace_idx ON memory_items(namespace_id);  
CREATE INDEX memory_items_metadata_gin ON memory_items USING
gin(metadata);  
-- Add HNSW once data volume justifies it and dimensions are final:  
-- CREATE INDEX memory_items_embedding_hnsw  
-- ON memory_items USING hnsw (embedding vector_cosine_ops);  
  
CREATE TABLE runs (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
multica_run_id text,  
agent_key text NOT NULL,  
task_type text,  
route text NOT NULL,  
selected_model text,  
policy_version text,  
status text NOT NULL,  
started_at timestamptz NOT NULL DEFAULT now(),  
ended_at timestamptz,  
metadata jsonb NOT NULL DEFAULT '{}'::jsonb  
);  
  
CREATE TABLE decisions (  
id bigserial PRIMARY KEY,  
run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
dimension text NOT NULL,  
choice text,  
probability real,  
raw_scores jsonb,  
decision_model text NOT NULL,  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE model_events (  
id bigserial PRIMARY KEY,  
run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
provider text,  
model text,  
input_tokens bigint,  
output_tokens bigint,  
cached_tokens bigint,  
cost_usd numeric(12,6),  
latency_ms integer,  
success boolean NOT NULL,  
error_class text,  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE tool_events (  
id bigserial PRIMARY KEY,  
run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
tool_name text NOT NULL,  
operation text,  
approved_by text,  
latency_ms integer,  
success boolean NOT NULL,  
error_class text,  
metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE human_feedback (  
id bigserial PRIMARY KEY,  
run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
rating smallint CHECK (rating BETWEEN 1 AND 5),  
correction_type text,  
comment text,  
created_at timestamptz NOT NULL DEFAULT now()  
);

## 8.4 Retrieval and write policy

- Retrieve by namespace and security scope first, semantic similarity
  second. A vector match must never cross a namespace the agent is not
  authorized to read.

- Use hybrid retrieval: relational filters (project, sensitivity, kind,
  recency) plus vector similarity. Add full-text search if useful.

- Write durable memory only after an extraction step decides the
  information is reusable. Store the source/provenance and a confidence
  value.

- Allow supersession rather than silent overwrite. New information can
  point to an older memory using supersedes_id.

- Sensitive memories remain local to PostgreSQL. Only retrieved excerpts
  needed for the active private task should be transmitted to the GPU
  VPS.

- Embedding model choice is an implementation parameter. Do not freeze
  vector dimensions until the embedding model is selected.

# 9. MCP and Capability Governance

Bifrost can connect STDIO, HTTP, and SSE MCP servers, discover tools,
enable or disable individual tools, and control automatic execution
\[8\]. The pilot should exploit that as a capability firewall rather
than treating MCP as a flat toolbox.

| **Capability class** | **Examples**                                          | **Default policy**                                      |
|----------------------|-------------------------------------------------------|---------------------------------------------------------|
| read-public          | web search, public repo read                          | May auto-execute for allowed agents.                    |
| read-private         | local files, private repo, personal calendar          | Agent-specific grants; audit every call.                |
| write-reversible     | create branch, write draft file, add note             | Auto only inside scoped workspace/sandbox.              |
| write-external       | send email, modify calendar, push to shared repo      | Human approval by default.                              |
| high-impact          | payments, destructive admin, account/security changes | Explicit human confirmation; often excluded from pilot. |

# 10. Observability and Feedback Loop

Bifrost provides request-level observability and can record
model/provider calls, token usage, latency, errors, and tool-related
behavior \[10\]. The pilot should normalize selected telemetry into the
local runs/model_events/tool_events tables so routing can be analyzed
independently of any single gateway.

Task → classify → policy → route → model/tool calls → result → human
response  
↑ │  
└──────────── memory + run telemetry + corrections ──────┘  
  
Primary optimization metric:  
cost per successfully completed task  
  
Supporting metrics:  
• success on first route  
• escalation rate  
• tool-call validity / tool failure rate  
• human correction rate  
• latency to useful result  
• input/output/cache tokens  
• cost by task type and agent  
• privacy-route frequency

# 11. Security Model

| **Control**      | **Pilot implementation**                                                                                                        |
|------------------|---------------------------------------------------------------------------------------------------------------------------------|
| Secrets          | .env only for development; migrate provider keys to Docker secrets or a secrets manager after validation. Never commit secrets. |
| Database         | No public port; strong credentials; encrypted backups; least-privilege DB roles for apps.                                       |
| Privacy VPS      | Tailscale ACL + host firewall; inference port unavailable publicly; minimal packages/services.                                  |
| Model routing    | Privacy decision occurs before Zen/external model call. Policy service is authoritative.                                        |
| MCP tools        | Per-agent allowlists and approval classes; separate credentials where practical.                                                |
| Agent filesystem | Dedicated workspace mounts; read-only mounts for critic/reviewer roles; avoid mounting host root.                               |
| Logs             | Redact secrets; configurable retention; avoid logging full sensitive prompts unless explicitly required.                        |
| Backups          | PostgreSQL logical/base backups plus Compose config; restore test required.                                                     |
| Supply chain     | Pin container tags/digests after pilot; review MCP server source and permissions before adding.                                 |

# 12. Implementation Phases

| **Phase**                         | **Deliverable**                                                                                                                   |
|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Phase 0 — VM foundation           | Create Ubuntu VM, Docker Engine/Compose, Tailscale, repo structure, backup destination, firewall.                                 |
| Phase 1 — State + gateway         | Deploy PostgreSQL/pgvector, Redis, Bifrost; connect Zen/provider credentials; validate request logging and budgets.               |
| Phase 2 — Decision + policy       | Deploy llama.cpp decision model and policy service. Log decisions. Implement privacy hard-stop and tier aliases.                  |
| Phase 3 — Agent runtime           | Add Pi runtime, one research agent and one builder agent. Connect a minimal MCP set and enforce tool scopes.                      |
| Phase 4 — Multica control surface | Connect Multica/runtime workflow so issues create runs and results return to the human-visible timeline.                          |
| Phase 5 — Memory                  | Add selective memory extraction, retrieval, namespaces, provenance, and project context injection.                                |
| Phase 6 — Private VPS             | Provision GPU VPS, Tailscale ACL, private model server, Bifrost privacy route, and explicit no-cloud-escalation behavior.         |
| Phase 7 — Evaluation loop         | Build dashboards/reports for route success, cost, tool failures, escalations, and human corrections; tune thresholds empirically. |

# 13. Pilot Success Criteria

- One Multica issue can trigger a bounded Pi workflow and return a
  readable result/progress record.

- Every model request is attributable to a route, model, provider, run,
  cost, and latency record.

- Privacy-tagged tasks cannot reach Zen or another external model
  provider without an explicit human override path.

- Agents can use approved MCP tools while denied tools remain
  unavailable or approval-gated.

- Project memory can retrieve relevant prior decisions with provenance
  and without cross-namespace leakage.

- At least three model tiers can be swapped behind aliases without
  modifying agent prompts/configurations.

- A failed or low-confidence Small route can escalate automatically to
  Balanced; privacy routes never auto-escalate externally.

- Human feedback is associated with the originating run and can be used
  to analyze routing quality.

- The stack can be restored from documented backups onto a fresh VM.

# 14. Open Questions / Research Agenda

- Which decision model (Julia/Laya/Kev/OpenJev or successor) offers the
  best confidence calibration for personal task routing on CPU?

- When does a decision-model score improve routing enough to justify an
  ML classifier over deterministic heuristics?

- What model tier minimizes cost per successful tool-using task for
  research, coding, writing, and personal operations?

- Can human corrections be converted into routing policy updates without
  creating opaque personalization or brittle overfitting?

- What should count as durable memory, and how can the system expose why
  a memory was retrieved and when it should expire?

- How should privilege escalation work when an agent needs a tool
  outside its normal capability envelope?

- How should private tasks be summarized/redacted when the human elects
  to escalate them to a cloud frontier model?

- Where is the boundary between a Multica agent identity and a Pi
  sub-agent/workflow, and which abstraction produces the clearest human
  mental model?

- How much autonomy is beneficial before reporting/approval overhead
  becomes either too noisy or too permissive?

# 15. Recommended v0.1 Bill of Materials

| **Layer**     | **v0.1 choice**                             | **Rationale**                                                                         |
|---------------|---------------------------------------------|---------------------------------------------------------------------------------------|
| Human control | Multica                                     | Issue/run-centric human + agent workspace with connected runtimes.                    |
| Decision      | llama.cpp + Kev-4B-class model              | Local, small, typed probabilistic decisions via SystemOne.                            |
| Policy        | Small custom service (Python/FastAPI or Go) | Deterministic routing/approval logic; easy to test and version.                       |
| Gateway       | Bifrost                                     | Unified provider API, routing/fallbacks, MCP, budgets, observability.                 |
| Agents        | Pi                                          | Scoped terminal/SDK agent execution with local/compatible endpoints.                  |
| Normal models | OpenCode Zen behind Bifrost                 | Elastic PAYG Small/Balanced/Deep pools.                                               |
| Private model | 20–30B-class model on GPU VPS               | Private-from-model-provider route; benchmark tool reliability before final selection. |
| Memory        | PostgreSQL + pgvector                       | Relational provenance and vector retrieval in one inspectable store.                  |
| Queue/cache   | Redis                                       | Ephemeral state, locks, queue/caching where needed.                                   |
| Network       | Tailscale                                   | Private host-to-host connectivity and ACLs; no public control-plane exposure.         |
| Deployment    | One Ubuntu VM + Docker Compose              | Fast pilot, simple backup/debugging; split later only when evidence warrants.         |

# 16. Conclusion

The proposed Personal Agentic OS is intentionally asymmetric. Human
coordination, classification, policy, memory, permissions, and audit
remain under personal control on the Proxmox server. Most raw model
capability is rented elastically through Zen and other providers behind
Bifrost. A separate GPU VPS exists only to provide a privacy-preserving
inference path when external model providers are not acceptable. Pi
agents operate within delegated capability boundaries, while Multica
preserves the project narrative and human intervention loop.

The architecture therefore treats models as replaceable cognitive
resources rather than the center of the system. The durable asset is the
control plane: goals, routing policy, agent scopes, memory, telemetry,
and feedback. That is the part capable of improving with use, surviving
changes in model vendors, and supporting a genuinely personal form of
agentic computing.

# References

**\[1\] Multica, “Agents.”** https://multica.ai/docs/agents

**\[2\] Multica, “How Multica works” and “Daemon and runtimes.”**
https://multica.ai/docs/how-multica-works ;
https://multica.ai/docs/daemon-runtimes

**\[3\] Hugging Face / ggml-org, “New in llama.cpp: Decision Models,”
Oct. 2, 2026.**
https://huggingface.co/blog/ggml-org/decision-models-in-llamacpp

**\[4\] Pi documentation.** https://pi.dev/docs/latest

**\[5\] Tailscale, “Docker.”**
https://tailscale.com/docs/features/containers/docker

**\[6\] Tailscale, “Tailscale Serve.”**
https://tailscale.com/docs/features/tailscale-serve

**\[7\] Maxim / Bifrost, “Gateway setup.”**
https://github.com/maximhq/bifrost/blob/dev/docs/quickstart/gateway/setting-up.mdx

**\[8\] Maxim / Bifrost, “Connecting to MCP servers” and “Tool
calling.”**
https://github.com/maximhq/bifrost/blob/dev/docs/mcp/connecting-to-servers.mdx

**\[9\] pgvector, project README.** https://github.com/pgvector/pgvector

**\[10\] Maxim / Bifrost, “Built-in Observability.”**
https://github.com/maximhq/bifrost/blob/dev/docs/features/observability/default.mdx

# Appendix A — Environment and Secret Categories

| **Category**          | **Examples**                                   | **Storage**                                                                        |
|-----------------------|------------------------------------------------|------------------------------------------------------------------------------------|
| Database              | POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL | Docker secret / protected env file.                                                |
| Bifrost provider keys | Zen/OpenAI/Anthropic/etc. credentials          | Bifrost secret store/env; never passed to agents.                                  |
| Private VPS           | Endpoint URL, API token                        | Bifrost only.                                                                      |
| Tailscale             | Auth key during enrollment                     | Short-lived/reusable policy as appropriate; remove bootstrap key after enrollment. |
| MCP credentials       | GitHub, calendar, email, SaaS tokens           | Prefer per-service/per-agent credentials; secret files or OAuth flows.             |
| Multica runtime       | CLI/runtime authentication                     | Runtime host; avoid duplicating into unrelated containers.                         |

# Appendix B — Backup and Restore Minimum

- Nightly PostgreSQL backup with retention and periodic restore test.

- Back up Compose files, policy configuration, MCP configuration, agent
  skills, and migrations in Git.

- Back up Bifrost app directory/configuration database if using its
  persistent UI configuration.

- Redis is not authoritative; design so loss of Redis is recoverable.

- Decision-model weights can be re-downloaded; preserve exact
  model/version/checksum in configuration.

- Private VPS should be disposable: infrastructure/config can recreate
  it, with no unique durable user data stored there.

- Use Proxmox backups/snapshots as an additional recovery layer, not as
  the only database backup mechanism.
