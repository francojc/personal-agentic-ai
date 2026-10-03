# PAOS hands-on setup workbook

## New direction

Keep the tiered architecture; change who builds it and how progress is measured. Jerid runs setup, makes configuration decisions, and verifies each result. Simon explains, documents, and troubleshoots; no remote changes, installations, deployments, paid requests, or service restarts unless explicitly requested.

This workbook governs the learning sequence. The [tiered plan](../plans/paos-tiered-implementation.md) remains an architecture and safety reference, not an automatic execution queue. Existing implementation is a prototype to inspect, not a prerequisite to understand all at once.

**Success:** you can open each chosen interface through Tailscale, find its process/configuration/data on the VM, explain its role, and recover from a small failure yourself.

## Ground rules

- One service or concept per session, roughly 30–60 minutes. Stop at each checkpoint.
- Read commands before running them. Know which machine you are on.
- Start with inspection and synthetic data. No agent tasks during interface setup.
- Preserve existing VM, legacy Mac stack, secrets, volumes, and unfinished repository work. No deletion or cutover implied by this reset.
- Keep credentials, sign-in codes, raw logs, private host identifiers, and task content out of shared notes. Use a password manager and local-only notes.
- Never expose services with Tailscale Funnel, public router forwarding, or `0.0.0.0` bindings for convenience.
- Tailscale network access does not replace application authentication. Review who can reach each admin interface.
- Backup/restore and verified spend controls still gate real-data/paid use. Simpler learning sequence does not mean weaker safety.

## Starting point – recorded, not freshly verified

Repository notes report Debian 13 VM 103 `paos-control`, 4 vCPU, 8 GiB RAM, 96 GiB disk; Multica 0.6.1 and Bifrost 2.2.5 installed. Multica already has private HTTPS; Bifrost administration remains loopback-only. Worker uses custom launcher, sandbox, policy, and mock model provider.

**Mock mode is not real inference.** Search is not configured, gateway budget enforcement is unverified, and encrypted independent recovery is unfinished. Workstation checkout and installed guest runtime differ. Do not deploy current checkout merely to make them match.

Sources: [deployment record](DEPLOYMENT.md), [progress snapshot](PROGRESS.md), [compatibility baseline](COMPATIBILITY.md). Verify observations yourself before changing anything.

## Choose your lab path

- [ ] Inspect existing VM first – recommended, no rebuild required.
- [ ] Decide afterward: learn in existing prototype or create a separate clean learning VM.
- [ ] If separate VM: choose capacity, unused VM ID, hostname, SSH access, storage, and unique state/project names before provisioning. Preserve prototype.
- [ ] Decide whether worker should remain active during lessons. Stopping it is optional and requires checking no task is running.

Do not run `scripts/setup.sh`, `scripts/update.sh`, or `scripts/provision-guest.sh` as a reset. They are not this workbook's starting step.

## Map to keep in your head

```text
Your browser on a Tailscale device
  |
  +-- HTTPS :443  --> guest Tailscale Serve --> Multica frontend/backend
  |
  +-- HTTPS :8443 --> guest Tailscale Serve --> Bifrost admin/API :8081
                       (proposed addition; you configure it)

Inside guest
  Multica web/server + database  [Compose project: multica]
  Multica daemon                [host systemd service; separate from web/server]
    --> restricted Pi launcher --> gateway filter :8082 --> Bifrost
  Bifrost + gateway filter      [Compose project: paos]
```

Multica is task/workspace interface. Its daemon starts agent processes. Bifrost routes model requests and owns provider credentials. Gateway filter is a worker-only API boundary, not an admin UI. Postgres is storage, not a browser destination.

For this lab, use guest-level Tailscale Serve. Do not add TSDProxy, Caddy, dashboards, or a second publication system yet. Older workshop architecture uses TSDProxy; that is a separate deployment.

## Session 1 – find your way around the VM

**Goal:** distinguish workstation, hypervisor, guest, containers, and worker.

### You do

1. In Proxmox web UI, inspect existing VM hardware and console. Do not edit hardware yet.
2. From workstation, connect using your verified SSH destination. Substitute actual address below; do not assume an SSH alias exists.

```bash
# WORKSTATION – replace placeholder first
ssh paos@<verified-guest-address>
```

```bash
# GUEST – read-only inventory
hostname
uname -sm
head -n 6 /etc/os-release
id
free -h
df -h / /srv
systemctl is-active docker tailscaled multica-daemon
docker version
docker compose version
docker compose ls
sudo ss -lntp
```

3. Locate `/srv/paos/repo`, `/srv/paos/secrets`, `/srv/paos/workspaces`, `/opt/paos`, `/etc/paos`, and `/var/lib/paos`. Inspect names/permissions, not secret contents.

```bash
# GUEST
ls -ld /srv/paos/{repo,secrets,workspaces} /opt/paos /etc/paos /var/lib/paos
cd /srv/paos/repo
git status --short
./scripts/paos.sh status
```

`paos.sh status` inspects both projects. Read `scripts/paos.sh` in your editor to see explicit project names, Compose files, and secret-file paths. Docker access is effectively root-level; worker must not have it.

### Checkpoint

- [ ] I know which terminal is connected to which machine.
- [ ] I can explain containers versus host systemd daemon.
- [ ] I found configuration, secrets, persistent data, and workspace paths.
- [ ] I recorded discrepancies without trying to fix everything.

## Session 2 – understand existing Multica web access

**Goal:** open private interface and trace browser request to VM service.

```bash
# GUEST – inspect locally; do not paste raw network output into shared notes
tailscale version
tailscale status
tailscale serve status
tailscale funnel status
curl -sS -o /dev/null -w 'frontend HTTP %{http_code}\n' http://127.0.0.1:3000/
curl -sS -o /dev/null -w 'backend HTTP %{http_code}\n' http://127.0.0.1:8080/health
```

Use exact HTTPS address from `tailscale serve status`. Existing mapping should send root to frontend port 3000 and `/health`, `/ws`, `/api/daemon/ws` to backend port 8080. Read `scripts/tailnet-serve.sh` to understand mapping; do not rerun it if current routes already work.

1. Open Multica on workstation while Tailscale is connected.
2. Sign in using existing account. Current deployment has no email delivery; login codes may require local backend-log inspection. Treat codes and logs as secrets; do not paste them into chat.
3. Inspect workspace, agent, issue, and run screens without starting a task.
4. Open browser developer tools → Network. Find `/api/config` and WebSocket traffic. Do not export HAR files; they can contain credentials.
5. Test from second authorized Tailscale device.

If redirect/origin/WebSocket behavior fails, compare chosen HTTPS origin with Multica `FRONTEND_ORIGIN`, `MULTICA_APP_URL`, `MULTICA_PUBLIC_URL`, and trusted-proxy settings locally. Do not change all settings at once. Existing routes were previously tested; that is not proof they work now.

### Checkpoint

- [ ] Multica loads over valid private HTTPS on two devices.
- [ ] I know which requests reach frontend versus backend.
- [ ] I understand web server can work while agent daemon is stopped.
- [ ] Funnel is not publishing this service.

## Session 3 – add private Bifrost browser access yourself

**Goal:** expose existing loopback admin listener through Tailscale without altering Multica routes.

Use separate HTTPS port first: `https://<guest-FQDN>:8443`. Separate listener avoids subpath/base-URL surprises and keeps existing Multica port 443 intact. Named per-service URLs can be a later networking lesson.

### Before changing anything

- [ ] Review current Serve routes; confirm 8443 is unused by Serve and other listeners.
- [ ] Confirm guest belongs to your tailnet and HTTPS certificates are enabled.
- [ ] Review effective Tailscale access policy: intended admin devices/users need TCP 8443; unintended peers should not. Do not replace whole tailnet policy to fix one port.
- [ ] Confirm Bifrost admin authentication is enabled and credentials are available securely. Do not reset encryption key or secret file.

```bash
# GUEST – read-only checks
tailscale serve --help
tailscale serve status
sudo ss -lntp
curl -sS -o /dev/null -w 'Bifrost HTTP %{http_code}\n' http://127.0.0.1:8081/
```

A login page, redirect, or auth rejection can indicate reachable service; connection refused indicates listener problem. Investigate unexpected response before publication.

**State-changing command – run yourself only after checks:**

```bash
# GUEST – adds persistent private HTTPS listener; leaves :443 routes unchanged
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8081
sudo tailscale serve status
```

Read enrollment/certificate prompts before accepting. Open exact reported URL with `:8443`, sign in, and test second device. If installed CLI rejects flag or port, stop and inspect its help; do not substitute Funnel or public bind.

**Undo only this new listener:**

```bash
# GUEST – removes :8443 publication, not Bifrost container or Multica :443
sudo tailscale serve --https=8443 off
```

Do not run `tailscale serve reset`; that would remove existing Multica publication too.

### Browser and VM comparison

Inspect providers, model alias, virtual keys, logs, and budgets without sending inference requests. Current PAOS Bifrost configuration uses `source_of_truth: config.json` with read-only bind mount; do not assume UI edits are durable or permitted. Compare UI with `config/paos/bifrost/config.json` and actual running mount paths. Never print full container environment or resolved Compose configuration; those can expose secrets.

Before any restart/recreation, determine whether guest uses test override `tests/mock/bifrost.config.json`. Starting base project without override can change provider routing. Leave mock exit procedure paused until separately reviewed.

### Checkpoint

- [ ] Multica still works on 443; Bifrost works on 8443.
- [ ] Bifrost requires application sign-in.
- [ ] Local bind remains `127.0.0.1:8081`; no LAN/public port opened.
- [ ] I know provider key versus worker virtual key versus admin password.
- [ ] I can remove only new Serve listener.
- [ ] I understand configured budget is not yet proven enforcement.

## Session 4 – learn lifecycle and persistence

**Goal:** understand startup and data ownership before installing more.

Read `compose.paos.yaml`, vendor Multica Compose file, `config/paos/multica-daemon.service`, and `scripts/paos.sh`. In editor, identify image pins, mounts, port bindings, environment-file references, and restart policy. Do not execute full setup scripts.

- [ ] Trace Bifrost config bind mount versus its data volume.
- [ ] Find Multica database volume and distinguish it from workspace files.
- [ ] Explain why gateway filter exposes only worker API, not admin interface.
- [ ] Inspect daemon unit with `systemctl cat multica-daemon`; keep output local.
- [ ] Plan one controlled stop/start, expected symptom, and exact reversal before doing it.
- [ ] Review wrapper behavior before lifecycle command. No `down -v`, pruning, broad updates, or secret regeneration.

Optional experiment: after confirming no task is active, stop only daemon with `sudo systemctl stop multica-daemon`; verify web UI remains available, then restore with `sudo systemctl start multica-daemon`. This changes VM state; choose when to do it yourself. Inspect status locally. Do not start tasks as part of this lesson.

## Session 5 – installation path, one layer at a time

After inspection, choose existing VM or separate clean VM. For a clean build, write exact version-specific installation commands together before running them; existing provisioner is reference material, not a one-shot assignment.

| Layer | You set up | Proof before advancing |
|---|---|---|
| Guest | Debian, admin SSH, updates, disk layout | Correct guest; key login; adequate storage; recovery access |
| Network | Tailscale enrollment, allowed peers, HTTPS | SSH/private reachability; understood policy; no Funnel |
| Containers | Docker Engine and Compose | Daemon works; project isolation; log limits; loopback bindings |
| Bifrost alone | Pinned image, persistent storage, stable encryption secret, admin auth | Local then private web login; restart preserves state |
| Multica alone | Pinned server/frontend/database, origin settings, account bootstrap | Health and private web login; signup policy reviewed |
| Worker later | Daemon, pinned runtime, minimum allowed capabilities | Explain each boundary; synthetic run only; cancel works |
| Real workflow last | One provider/model, search, limits, recovery | Verified billing controls; independent encrypted restore; explicit approval |

**Pause custom worker development:** cost reconciliation, provenance extensions, new classifiers, memory, GPU services, and additional dashboards are backlog, not setup homework. Existing protections remain intact; do not remove them blindly to simplify.

## Other interfaces – optional, not a shopping list

Add only after core lessons, one at a time. For each: purpose, auth, local bind, persistent state, private URL, allowed peers, health check, undo.

| Interface | Role | Decision |
|---|---|---|
| Proxmox existing web UI | VM hardware, console, snapshots | Use existing approved access; never proxy hypervisor through worker VM |
| Open WebUI | Chat interface separate from Multica tasks | Optional; not required for research agent |
| Browser editor / terminal | Files and shell | Defer; SSH first. Browser shell is powerful admin surface |
| Search service UI | Inspect self-hosted search if chosen | Only if choosing self-hosted backend |
| Metrics dashboard | Operational visibility | Defer until concrete need |

Database and worker gateway are not interfaces to publish. TSDProxy Docker-socket access and browser-terminal privileges add risk; convenience alone does not justify adding them.

## Session notes template

Keep real addresses and sensitive evidence in local-only notes, not this tracked workbook.

```text
Session:
Goal:
Machine:
What I changed:
Browser observation:
VM observation:
What I can now explain:
Checkpoint passed / blocked:
Undo:
One next step:
```

## First milestone

Stop once you can reach Multica and Bifrost privately, explain their backing services, and undo Bifrost publication. No need to finish entire platform before learning from it.

## References

- [Tailscale Serve CLI](https://tailscale.com/kb/1242/tailscale-serve): private reverse proxy, HTTPS ports, persistent `--bg`, and listener-specific `off` syntax. Reviewed while drafting; installed CLI help remains version authority.
- [Existing tiered plan](../plans/paos-tiered-implementation.md): architecture and safety gates.
- [Deployment record](DEPLOYMENT.md): existing paths, identities, origin routing, and known limitations.
- [Progress snapshot](PROGRESS.md): mock mode and unfinished verification; not an instruction to resume deployment.
