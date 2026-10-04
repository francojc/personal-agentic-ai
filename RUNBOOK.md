# PAOS – fresh-start phased runbook

## How to use this

Start with no VM, no Docker, no Tailscale enrollment on guest, no application accounts, no provider credentials, and no worker. Existing Proxmox host and your workstation are prerequisites, not application setup already completed.

You run every step. Assistant explains commands and helps with one blocker at a time; no automatic remote setup. Allow 30–60 minutes per session, longer for OS install/downloads. Stop at each checkpoint rather than pasting entire document into shell.

Default guest login shell is **Zsh** on Debian 13. Interactive recipes below work in Zsh unless labeled otherwise; scripts supplied by upstream still run with their own interpreter. Angle-bracket values are placeholders: replace before execution. Keep addresses, accounts, raw logs, and secrets in local-only notes or password manager. Never paste `.env`, `docker inspect` environments, resolved Compose output, verification codes, or HAR exports into chat.

**Status:** source-reviewed recipes; not executed against new guest. Version candidates are Bifrost `v2.2.5`, Multica `v0.6.1`. Verify availability/security advisories before installation. Stop on unavailable pin; do not silently use `latest`.

### Navigation

- [Phase 0 – reset safely](#phase-0--reset-safely)
- [Phase 1 – create Debian VM](#phase-1--create-debian-vm)
- [Phase 2 – join Tailscale](#phase-2--join-tailscale)
- [Phase 3 – Docker and checkout](#phase-3--docker-and-checkout)
- [Phase 4 – Bifrost web and VM](#phase-4--bifrost-web-and-vm)
- [Phase 5 – Multica web and VM](#phase-5--multica-web-and-vm)
- [Phase 6 – independent recovery](#phase-6--independent-recovery)
- [Phase 7 – one manual model request](#phase-7--one-manual-model-request)
- [Phase 8 – first worker experiment](#phase-8--first-worker-experiment)
- [Phase 9 – optional interfaces](#phase-9--optional-interfaces)
- [Operations and troubleshooting](#operations-and-troubleshooting)

## Architecture and names

```text
Workstation / second authorized device
  | Tailscale private HTTPS
  +-- https://gateway.<tailnet>.ts.net --> Bifrost :8081 --> provider (later)
  +-- https://paos.<tailnet>.ts.net    --> Multica frontend :3000
                                  selected paths --> backend :8080

Debian guest
  Compose project paos:     Bifrost + persistent data
  Compose project multica:  upstream frontend, backend, Postgres, uploads
  Worker (later):           dedicated Unix user, not Docker administrator
```

No TSDProxy, Caddy, merged Compose stack, or custom PAOS runtime in baseline. Postgres has no published host port. Host ports 3000, 8080, 8081 bind only to loopback. VM hostname is **paos** in Proxmox, Debian, and Tailscale. Multica uses ordinary node-level Tailscale Serve on `https://paos.<tailnet>.ts.net`; Bifrost uses named **Tailscale Service** `svc:gateway` on `https://gateway.<tailnet>.ts.net`. Both use HTTPS 443 on distinct Tailscale destinations. Do not define a separate `svc:paos`; reuse VM's node name for Multica and SSH.

| Location | Purpose |
|---|---|
| `/srv/paos/repo` | This repository; Bifrost Compose/config and private `.env` |
| `/srv/paos/repo/vendor/multica` | Pinned upstream checkout; separate private `.env` |
| `/var/lib/docker` | Docker-managed images and persistent volumes |
| `/srv/paos/workspaces` | Future worker output only |
| Password manager | Stable secrets and recovery instructions |
| Independent backup destination | Encrypted recovery copy outside VM and host failure domain |

## Phase 0 – reset safely

**Goal:** intentionally empty starting point, not accidental loss of unrelated VM.

Previous VMs have been removed by operator. Fresh VM is **Proxmox QEMU VM 200** (`qm 200`), named `paos`. Confirm ID 200 remains unused immediately before creation; no further deletion is part of setup.

1. Confirm old VM removal is complete and no retained data is needed for fresh build.
2. Review stale Tailscale machine/service entries; remove only confirmed retired identities yourself. Preserve working hypervisor/workstation entries.
3. Confirm **200** is unused in Proxmox. Stop on collision; do not overwrite another guest.
4. Reserve device name **paos** and service name **gateway** in intended tailnet; inspect stale device/service collisions rather than accepting suffixed names.
5. Do not copy old workstation `.env`, volumes, database, PAT, worker settings, or mock configuration into new build.

### Decisions before allocation

| Decision | Starting recommendation | Your choice |
|---|---|---|
| Guest OS | Debian 13 amd64, minimal, no desktop | |
| VM | **QEMU VM 200**, hostname `paos` | Confirmed |
| Default shell | **Zsh** for admin and future worker | Confirmed |
| Tailscale web names | Multica **paos**; Bifrost **gateway**, HTTPS 443 | Confirmed |
| Capacity | 4 vCPU, 8 GiB fixed RAM, 96 GiB disk | |
| Bridge/network | Existing approved LAN bridge, DHCP/reservation | |
| Admin | `paos`, SSH public key, sudo | |
| Recovery access | Working Proxmox console | |
| Backup target | Independent encrypted copy; choose before Phase 6 | |
| Provider | OpenCode Zen candidate; no key yet | |
| Spend | Proposed $20/month total, $0.50/test ceiling; reapprove before use | |

Recommendations are not reservations. Check Proxmox memory pressure, swap, storage, and workloads before allocation. Keep host reserve; do not infer capacity from instantaneous free RAM alone. No sensitive data may leave home; no eligible local model yet means private tasks do not run.

**Checkpoint:** [ ] Previous VMs removed. [ ] VM 200 available; capacity checked. [ ] Device/service names reserved. [ ] No old state needed for next phase.

## Phase 1 – create Debian VM

**Goal:** learn VM creation and OS administration before containers.

### Proxmox web UI – you do

UI labels vary slightly by Proxmox version. These choices assume an x86-64 Proxmox host, ordinary Linux guest, and no GPU/PCI passthrough. Enable **Advanced** in wizard where needed; leave settings not listed at defaults.

#### Before opening Create VM

1. Obtain Debian 13 amd64 netinst ISO from [official Debian downloads](https://www.debian.org/distrib/). Verify published checksum and signature with Debian instructions; record filename/checksum locally.
2. Select intended **node → Summary**: inspect CPU, RAM, swap, and existing workloads. VM gets 8 GiB fixed RAM; leave reserve for Proxmox and storage services such as ZFS.
3. Inspect storage in sidebar and **Datacenter → Storage**. ISO storage must allow **ISO image** content; VM disk storage must allow **Disk image** content. `local` often holds ISO files; `local-lvm` often holds disks. Names are examples, not instructions to create/convert storage.
4. Select ISO-capable storage → **ISO Images → Upload**; upload verified ISO. Do not select backup archive or container template.
5. Select node → **System → Network**; identify bridge connected to intended LAN, often `vmbr0`. Inspect existing bridge/physical NIC rather than changing host networking from this lesson. Wrong bridge can leave guest unreachable.
6. Click **Create VM**. Confirm ID **200** unused.

#### Create VM wizard – field-by-field

| Tab / field | Select | Why / what to watch |
|---|---|---|
| General → Node | Intended Proxmox host | Chooses physical server, not guest hostname. |
| General → VM ID | **200** | Proxmox inventory identity; independent of IP address. |
| General → Name | **paos** | Sidebar/display name only; Debian hostname must also be set in installer. |
| General → Resource Pool | Leave unset unless you already use pools | Administrative grouping, not disk storage or CPU allocation. |
| OS → CD/DVD | Use uploaded Debian 13 amd64 netinst ISO | Installer media; will be detached after installation. |
| OS → Guest OS | Linux; current Linux kernel option such as **6.x–2.6 Kernel** | Optimizes defaults; does not install Debian itself. |
| System → Graphic card | Default | Standard noVNC console; no GPU passthrough required. |
| System → Machine | Default **i440fx** | Sufficient for this non-passthrough guest. Q35 adds PCIe topology but is not needed here. |
| System → BIOS | **SeaBIOS** | Simple supported Debian boot path; no EFI disk, Secure Boot keys, or TPM needed. Do not switch firmware after installation as a casual fix. |
| System → SCSI Controller | **VirtIO SCSI single** | Debian supports paravirtualized drivers; enables per-disk I/O thread. |
| System → QEMU Agent | **Enabled** | Provides guest IP reporting and coordinated shutdown/backup support once guest package runs. No agent installed by checkbox alone; temporary “not running” status is expected. |
| System → TPM | Do not add | Not required for this Debian lab. |
| Disks → Bus/Device | **SCSI**, first disk **scsi0** | Uses chosen VirtIO SCSI controller. |
| Disks → Storage | Existing approved disk-image storage | Check available capacity and backup support; do not repartition host. |
| Disks → Disk size | **96 GiB** | OS, images, volumes, and temporary backups share this space. Thin allocation still needs capacity monitoring. |
| Disks → Format | Storage default | Block storage generally uses raw; file storage may offer qcow2. Snapshot support depends on storage/format; do not force unavailable option. |
| Disks → Cache | **Default (No cache)** | Balanced baseline; do not choose unsafe/write-back modes for convenience. |
| Disks → IO thread | **Enabled** | Moves disk I/O handling off main VM execution thread with VirtIO SCSI single. |
| Disks → Discard | Enable if backing storage supports thin provisioning/TRIM | Lets guest reclaim unused blocks with `fstrim`; does not shrink guest's 96 GiB virtual capacity. Otherwise leave off. |
| Disks → SSD emulation | Enable for SSD-backed storage; otherwise leave off | Guest scheduling hint, not storage acceleration. |
| Disks → Backup | **Enabled**; “No backup” unchecked if shown | Disk must be included in Phase 6 full-VM backup. |
| CPU → Sockets / Cores | **1 socket / 4 cores** | Four total vCPUs; does not reserve four dedicated physical cores. |
| CPU → Type | **host** for this single-host lab | Exposes host CPU features. For migration across unlike hosts, choose reviewed compatible CPU model instead. |
| CPU → NUMA / affinity / extra flags | Defaults; NUMA off | No custom topology or core pinning needed for small guest. |
| Memory → Memory | **8192 MiB** | Eight GiB; Proxmox field uses MiB. |
| Memory → Ballooning Device | **Disabled** | Keeps allocation predictable; no dynamic reclamation into host. Check capacity first. |
| Network → Bridge | Approved LAN bridge | Usually `vmbr0`, but verify physical uplink and intended LAN. No router/public port forwarding. |
| Network → Model | **VirtIO (paravirtualized)** | Efficient NIC supported by Debian without extra driver ISO. |
| Network → VLAN Tag | Leave blank for untagged LAN; approved VLAN only if required | Bridge/switch/DHCP must agree. Do not invent VLAN number. |
| Network → MAC / MTU / Rate limit | Defaults; record generated MAC | Use MAC for DHCP reservation if desired. Tailscale needs no custom MTU here. |
| Network → Firewall | Keep enabled and review effective datacenter/node/VM policy | Checkbox is not complete firewall policy. Existing rules must permit intended SSH and Tailscale traffic; guest UFW is separate. Do not disable host policy to fix access. |
| Confirm → Start after created | Leave unchecked | Review Hardware/Options once before first boot. |

After **Finish**, select **200 (paos) → Hardware**: confirm disk `scsi0`, NIC `net0`, ISO, 8192 MiB RAM, and 4 vCPUs. Under **Options**, leave **Start at boot** off during lessons; automatic startup can be an explicit later choice. No HA or replication configuration required.

#### Install Debian through Console

1. Click **Start → Console**; use standard Debian installer. Language, locale, keyboard, and timezone are your choices.
2. Set installer **hostname to `paos`**. Domain name: leave blank unless your LAN requires an existing domain; do not enter Tailscale suffix here.
3. Use DHCP initially; record LAN address. Prefer router-side reservation using VM MAC rather than guessing static address inside installer.
4. For this fresh VM, choose guided partitioning on its **96 GiB virtual disk**, with all files in one partition for simplicity. Confirm installer targets VM disk, not some attached passthrough disk. No additional host disks should be attached.
5. Create `paos` admin user. Leaving root password blank in standard Debian installer normally disables direct root login and grants first user sudo; verify afterward. If you choose separate root password, arrange sudo from root console before continuing.
6. Select **SSH server** and **standard system utilities**; deselect Debian desktop environment and all desktop choices. Accept GRUB installation to VM's boot disk.
7. Finish install. If prompted, remove media. In Proxmox **Hardware → CD/DVD Drive → Edit**, choose **Do not use any media**.
8. In **Options → Boot Order**, enable `scsi0` and move it first. Disable CD/DVD/network boot unless needed later. Confirm reboot reaches installed Debian, not installer.
9. Agent checkbox is already enabled; guest package is installed below. If checkbox was missed, shut VM down cleanly, enable **Options → QEMU Guest Agent**, then start VM so guest gets agent channel.

**Proxmox check:** Console reaches login; installed hostname is `paos`; disk boots without ISO. IP may not appear in Summary until guest agent is installed/running. Console works independently of guest network; do not mistake missing IP display for failed boot.

### Guest console – you do

```zsh
# GUEST
hostname
head -n 6 /etc/os-release
ip -br address
sudo apt update
sudo apt upgrade
sudo apt install ca-certificates curl git jq openssl sudo openssh-server ufw qemu-guest-agent vim zsh
sudo systemctl enable --now ssh qemu-guest-agent
```

Inspect package prompts. Set admin default login shell, then log out and back in:

```zsh
# GUEST – after zsh installation
sudo chsh -s /usr/bin/zsh paos
getent passwd paos
```

After new login, verify `echo "$SHELL"` reports `/usr/bin/zsh` and `zsh --version` works. Start with stock Zsh; no plugin framework required. Reboot if needed; reconnect via console. If sudo fails, fix account from console rather than continuing as root for application work.

### Workstation – establish SSH key access

Use existing appropriate SSH identity or create dedicated key yourself. Transfer **public** key only, never private key. If `ssh-copy-id` is unavailable, paste public key via Proxmox console into `~paos/.ssh/authorized_keys`; directory 0700, file 0600, owned by `paos`.

```zsh
# WORKSTATION – if ssh-copy-id is installed
ssh-copy-id -i ~/.ssh/<chosen-key>.pub paos@<guest-LAN-address>
ssh -i ~/.ssh/<chosen-key> paos@<guest-LAN-address>
```

Open second key-authenticated session before disabling password login. In guest, create `/etc/ssh/sshd_config.d/00-paos.conf` with:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

Validate effective configuration and reload, not blind restart:

```zsh
# GUEST
sudo sshd -t
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication'
sudo systemctl reload ssh
```

If effective settings differ, inspect included files before reloading. Keep console and current SSH session open until fresh key login succeeds.

**Browser lesson:** hardware/console in Proxmox is not application interface. **VM lesson:** OS, user accounts, disk, network, SSH.

**Checkpoint:** [ ] VM 200 running Debian 13. [ ] Zsh default verified after new login. [ ] Verified key-only new SSH login. [ ] Console fallback works. [ ] Resources recorded.

## Phase 2 – join Tailscale

**Goal:** private admin path before application publication.

Install/sign in to Tailscale on workstation and second test device using same intended tailnet. On guest, use official Debian trixie apt repository; no pipe-to-shell installer.

```zsh
# GUEST
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg -o /tmp/tailscale-keyring.gpg
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list -o /tmp/tailscale.list
# Inspect source list locally before installing it.
less /tmp/tailscale.list
sudo install -m 0644 /tmp/tailscale-keyring.gpg /usr/share/keyrings/tailscale-archive-keyring.gpg
sudo install -m 0644 /tmp/tailscale.list /etc/apt/sources.list.d/tailscale.list
sudo apt update
sudo apt install tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up --hostname=paos
```

Open enrollment URL yourself and confirm correct tailnet. Keep guest device hostname `paos`; resolve stale-name collision before continuing. Do not enable subnet routing, exit node, Funnel, or Tailscale SSH for this lesson; ordinary OpenSSH over Tailscale suffices.

```zsh
# GUEST – inspect locally
tailscale version
tailscale status
tailscale ip -4
tailscale serve status
tailscale funnel status
```

In Tailscale admin UI, enable MagicDNS/HTTPS certificates for Serve. Guest FQDN is `paos.<tailnet>.ts.net` for both SSH and Multica; gateway service has separate FQDN.

### Define gateway Tailscale Service

Multica uses node's **paos** name directly. Only Bifrost needs native Tailscale Service **gateway**; do not define `svc:paos` alongside same-named VM. Service host must have **tag-based identity** and Tailscale v1.86+; use v1.94+ on all clients to avoid older Linux route-acceptance requirements.

1. Review existing policy; authorize chosen admin to assign dedicated host tag such as `tag:paos-host`. Apply tag to VM device in admin UI. Tagged identity changes access/expiry behavior; retest SSH and review effective rules immediately. Do not replace whole policy.
2. In admin console → Services, define **gateway** (`svc:gateway`), advertising `tcp:443`.
3. Configure gateway service access for intended admin devices/users, independently of TCP 22/443 access to **paos** device. Defining service or approving host does not itself grant client access.
4. Phase 4 Serve command advertises VM as host for gateway. Approve its pending host advertisement in admin UI. Multica's node-level Serve needs no Service host advertisement.
5. Verify full URLs are `https://paos.<tailnet>.ts.net` and `https://gateway.<tailnet>.ts.net`; use exact reported tailnet suffix. If Services unavailable or tag/policy changes are not approved, stop instead of substituting port-only URLs.

Tagged nodes normally have key expiry disabled by default; review this intentionally. Gateway service is not another VM.

Review existing effective access rules. Intended admin identities/devices need **paos device** TCP 22 for SSH and TCP 443 for Multica, plus **svc:gateway** TCP 443 for Bifrost. Restrict other peers. Do not paste wholesale replacement policy; grants are additive and existing broad allow rules may defeat new restrictions. Test policy and an unauthorized peer if available. Tailscale access does not replace Multica/Bifrost sign-in.

```zsh
# WORKSTATION – verify before firewall changes
ssh -i ~/.ssh/<chosen-key> paos@<guest-FQDN>
```

### Guest firewall – only after access works

```zsh
# GUEST – retain current SSH session and Proxmox console
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
# Optional recovery LAN SSH: replace approved CIDR before running.
sudo ufw allow from <trusted-admin-LAN-CIDR> to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Allowing `tailscale0` relies on tested tailnet policy. Do not add broad LAN rules. Docker-published ports can bypass UFW: loopback bindings remain mandatory.

**Checkpoint:** [ ] SSH over Tailscale works in new session. [ ] Tagged host and service access reviewed. [ ] paos device FQDN and gateway service FQDN recorded. [ ] No Funnel. [ ] Firewall/recovery access verified.

## Phase 3 – Docker and checkout

**Goal:** understand privileged container administration and project isolation.

On fresh guest, install Engine from official Docker apt repository:

```zsh
# GUEST
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo usermod -aG docker paos
```

Log out and reconnect so group takes effect. Docker group is effectively root access. Never add agent/worker to it.

```zsh
# GUEST – new admin SSH session
docker version
docker compose version
docker info --format '{{.DockerRootDir}}'
sudo install -d -o paos -g paos -m 0750 /srv/paos
cd /srv/paos
git clone https://github.com/francojc/personal-agentic-ai.git repo
cd repo
git rev-parse HEAD
```

Checkout must contain this reset version. If not pushed yet, transfer intended revision through your normal Git workflow before proceeding. Do not silently use old setup scripts from remote branch.

Read `compose.yaml`, `.env.example`, and `config/bifrost/config.json` in editor. This Compose file manages **Bifrost only**, project `paos`. Multica will use explicit separate upstream project.

For vendor containers, cap Docker default logs before starting them. On this fresh guest, create `/etc/docker/daemon.json` in editor:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

If file already exists, merge settings rather than overwrite unknown configuration. Validate JSON with `sudo jq empty /etc/docker/daemon.json`, restart Docker before applications exist, then verify active. Defaults affect newly created containers.

**Checkpoint:** [ ] Docker/Compose work. [ ] Root-equivalent privilege understood. [ ] Correct repo revision. [ ] Read config. [ ] Docker data path/log limits known.

## Phase 4 – Bifrost web and VM

**Goal:** start one service, configure authenticated UI, prove persistence.

### Fresh secrets – guest only

```zsh
# GUEST – this must be fresh checkout without old .env
cd /srv/paos/repo
test ! -e .env && (umask 077; cp .env.example .env)
chmod 600 .env
```

If `.env` exists, stop and identify source. Do not overwrite or reuse blindly. Generate two independent secrets with `openssl rand -hex 32` in private terminal: one encryption key, one admin password. Paste into `.env` using local editor; store securely. Replace all `GENERATE_ME` values. Provider credentials are not needed yet.

Never regenerate `BIFROST_ENCRYPTION_KEY` after encrypted data exists. Environment `:?` detects missing variables, not placeholder strings; you must check replacements yourself.

```zsh
# GUEST – validation without dumping resolved secrets
docker compose -p paos -f compose.yaml --env-file .env config --quiet
docker compose -p paos -f compose.yaml --env-file .env pull bifrost
docker compose -p paos -f compose.yaml --env-file .env up -d bifrost
docker compose -p paos -f compose.yaml --env-file .env ps
curl -sS -o /dev/null -w 'Bifrost HTTP %{http_code}\n' http://127.0.0.1:8081/
```

If container fails, inspect logs locally. Auth redirect/rejection can be expected; connection refused or 5xx is not success.

### Bootstrap safely through SSH tunnel

```zsh
# WORKSTATION – leave this terminal running
ssh -N -L 18081:127.0.0.1:8081 paos@<guest-FQDN>
```

Open `http://localhost:18081`. Login with chosen Bifrost admin credentials. Verify unauthenticated/incognito access cannot use admin controls. No providers or model calls yet. Close tunnel with Ctrl+C when done.

Bootstrap file enables admin/inference authentication, disables prompt/content logging, and leaves configuration database enabled. No `source_of_truth: config.json`, empty provider array, or file-only mode: providers added through UI can persist. Read-only bootstrap mount does not make UI read-only. Edits to bootstrap entities may reconcile on restart; learn that before changing file.

### Private HTTPS publication

First inspect `tailscale serve --help` and `sudo tailscale serve status --json`; confirm `svc:gateway` has no conflicting endpoint. Then:

```zsh
# GUEST – persistent publication inside tailnet only
sudo tailscale serve --service=svc:gateway --https=443 http://127.0.0.1:8081
sudo tailscale serve status --json
sudo tailscale funnel status
```

Follow certificate prompts deliberately, then approve VM's pending **gateway** host advertisement in admin UI. Services run persistently without `--bg`. Open exact reported `https://gateway.<tailnet>.ts.net` from two authorized devices. Repeat login/incognito check. No LAN port exposure needed.

Undo publication only, without deleting service/data:

```zsh
# GUEST
sudo tailscale serve drain svc:gateway
# Wait for active connections to finish, then remove only gateway endpoint.
sudo tailscale serve --service=svc:gateway --https=443 off
```

### Browser/VM learning exercise

- Browser: identify provider, logs, virtual keys, budgets, and authentication screens without adding paid credentials.
- Guest: `docker volume ls --filter label=com.docker.compose.project=paos`; find Bifrost volume and config mount in Compose file.
- Restart Bifrost with same explicit Compose command and `restart bifrost`; verify login/UI state remains. Later UI provider state also needs restart verification.
- Check listeners with `sudo ss -lntp`. Only `127.0.0.1:8081` should be published for Bifrost.

**Checkpoint:** [ ] Authenticated UI on private HTTPS. [ ] Two-device access. [ ] Stable key secured. [ ] Persistence path known. [ ] Undo known. [ ] No inference performed.

## Phase 5 – Multica web and VM

**Goal:** understand task interface and separate server/database lifecycle; no daemon yet.

### Pinned upstream checkout

```zsh
# GUEST
cd /srv/paos/repo
mkdir -p vendor
git clone --branch v0.6.1 --depth 1 https://github.com/multica-ai/multica.git vendor/multica
git -C vendor/multica rev-parse HEAD
```

Expected candidate commit: `2ea01ae4ef55de4310b99af192d2dbd367832883`. If different, investigate before continuing. Inspect upstream `docker-compose.selfhost.yml` in editor. Web/backend bind loopback; Postgres is unpublished. Do not merge it with `compose.yaml`.

```zsh
# GUEST – fresh vendor directory only
test ! -e vendor/multica/.env && (umask 077; cp multica.env.example vendor/multica/.env)
chmod 600 vendor/multica/.env
```

Replace placeholders locally: independent `POSTGRES_PASSWORD` and `JWT_SECRET` via `openssl rand -hex 32`; VCS key via `openssl rand -base64 32`. Store all secrets securely even though VCS integration stays disabled. Pin `MULTICA_IMAGE_TAG=v0.6.1`. Do not run upstream `make selfhost`: manual template already defines secrets and version.

```zsh
# GUEST
cd /srv/paos/repo/vendor/multica
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env config --quiet
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env pull
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env up -d
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env ps
curl -fsS http://127.0.0.1:8080/readyz
```

Expected readiness includes database and migrations `ok`. `/health` alone is liveness, not proof migrations succeeded. Database image `pgvector/pgvector:pg17` is floating in vendor file: record pulled digest and pin via small override before go-live/restore baseline. Do not edit vendor source casually.

### Bootstrap one account via tunnel, then close signup

```zsh
# WORKSTATION
ssh -N -L 3000:127.0.0.1:3000 paos@<guest-FQDN>
```

If workstation port 3000 occupied, stop and choose alternative; adjust local origin settings consistently rather than guessing. Open `http://localhost:3000`, request email verification code. On guest, inspect locally:

```zsh
# GUEST – output contains secret sign-in code; never share it
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env logs --tail=100 backend
```

No email service by default. Enter code, create workspace. In vendor `.env`, set `ALLOW_SIGNUP=false` immediately; existing account remains your login. Keep production mode and no fixed verification code.

### Configure one private origin

Set these three values to Multica HTTPS origin **without trailing slash**, `https://paos.<tailnet>.ts.net` (same hostname as SSH, but HTTPS URL):

```dotenv
FRONTEND_ORIGIN=https://paos.<tailnet>.ts.net
MULTICA_APP_URL=https://paos.<tailnet>.ts.net
MULTICA_PUBLIC_URL=https://paos.<tailnet>.ts.net
ALLOW_SIGNUP=false
```

These are substitutions, not literal values. Recreate to reread `.env`; `restart` does not reread it:

```zsh
# GUEST – vendor directory
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env up -d
sudo tailscale serve --bg --https=443 --set-path=/health http://127.0.0.1:8080/health
sudo tailscale serve --bg --https=443 --set-path=/ws http://127.0.0.1:8080/ws
sudo tailscale serve --bg --https=443 --set-path=/api/daemon/ws http://127.0.0.1:8080/api/daemon/ws
sudo tailscale serve --bg --https=443 http://127.0.0.1:3000
sudo tailscale serve status --json
```

Root goes to frontend; three explicit paths go to backend. `/ws` handles browser realtime; `/api/daemon/ws` handles future daemon connection; `/health` is CLI reachability probe. Tailscale terminates HTTPS. These are node-level routes on **paos**, not Service advertisements; `--bg` preserves them across daemon restarts. Do not add `/bifrost` subpath; Bifrost uses separate **gateway** service, also on 443.

### Verify from browser and VM

```zsh
# WORKSTATION – substitute real FQDN
curl -fsS https://paos.<tailnet>.ts.net/health
curl -fsS https://paos.<tailnet>.ts.net/api/config
```

Inspect `daemon_server_url` locally: should equal intended HTTPS origin, not localhost. Login and browse workspace/issues/agents/runs. Browser developer tools → Network: confirm WebSocket request reaches backend. Ordinary curl to WebSocket endpoint can return 400/401; that is not successful WebSocket proof. Test actual browser session.

No runtime/daemon exists yet; offline/no-runtime UI is expected. Do not assign issues hoping work will start.

Undo individual publications if needed:

```zsh
# GUEST – remove node-level Multica routes only; gateway service remains available
sudo tailscale serve --https=443 --set-path=/ off
sudo tailscale serve --https=443 --set-path=/health off
sudo tailscale serve --https=443 --set-path=/ws off
sudo tailscale serve --https=443 --set-path=/api/daemon/ws off
```

Do not use `tailscale serve reset` as routine fix; removes other interfaces too.

**Checkpoint:** [ ] Ready database/migrations. [ ] Account/workspace. [ ] Signup closed. [ ] Private HTTPS on two devices. [ ] Origin and browser realtime verified. [ ] Both Compose projects independently understood.

## Phase 6 – independent recovery

**Goal:** prove rebuild/restore before credentials, valuable data, or agents.

Choose encrypted off-host destination, retention, acceptable data loss/downtime, and secret escrow. Example starting retention: 7 daily + 4 weekly. VM snapshot alone does not satisfy this phase. Host-attached disk alone does not protect against host loss.

### Inventory and application backup

Record Git revision, image digests, both Compose project names, volume names, guest OS/packages, Tailscale Serve routes, and secret recovery location. Keep sensitive inventory in local-only notes.

```zsh
# GUEST – local-only backup, not yet independent/encrypted
umask 077
mkdir -p /srv/paos/backups
STAMP=$(date +%Y%m%d-%H%M%S)
cd /srv/paos/repo/vendor/multica
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env exec -T postgres \
  pg_dump -U multica -d multica -Fc > "/srv/paos/backups/multica-$STAMP.dump"
test -s "/srv/paos/backups/multica-$STAMP.dump"
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env exec -T postgres \
  pg_restore --list < "/srv/paos/backups/multica-$STAMP.dump" >/dev/null
```

Stop if dump command fails; file existence/listing does not prove complete restorable data. Defaults assume template's `multica` user/database. No pipeline into compressor hiding exit status.

### First recovery method – cold full-VM backup

Use Proxmox backup UI with VM stopped and chosen supported backup storage. Cold full-VM backup captures Docker databases/volumes consistently without inventing an untested volume-copy script. Export resulting backup to independent destination with encryption in transit and at rest; use chosen backup tool/storage, not plaintext public bucket. Choose encryption/recovery mechanism before declaring done. Proxmox backup encryption depends on selected storage/tool; do not assume every backup file is encrypted.

1. Stop workloads and shut guest down cleanly yourself.
2. Produce backup through Proxmox UI; confirm job success and included disks.
3. Copy/store independently with verified encryption. Store decryption secret outside VM in password manager/recovery escrow.
4. Restore into different unused VM ID with network disconnected. Never overwrite fresh working VM to test.
5. Boot isolated guest; inspect application readiness and preserved UI state via console/local tunnel as appropriate. Avoid duplicate Tailscale identity: cloned Tailscale state must not connect concurrently. Enroll distinct test identity only after resolving copied state intentionally.
6. Verify Multica account/workspace, Bifrost authentication/settings, secrets decrypt state, volumes, and sample dump restoration into a disposable database.
7. Record restore duration/result; safely retire isolated test only after you approve.

Full-VM recovery is initial proven method. Add scheduled DB/config/workspace backups later, with tested exact tooling. Do not copy live SQLite files or tar running Postgres volume as substitutes.

**Checkpoint:** [ ] Independent encrypted copy. [ ] Secrets recoverable. [ ] Isolated restore passed. [ ] Digests/pins recorded. [ ] Recovery instructions match actual tool chosen.

## Phase 7 – one manual model request

**Goal:** understand browser configuration → gateway → provider → cost, before agent loop.

This phase spends money only after explicit decision. Candidate provider is OpenCode Zen; verify current model availability, pricing, API compatibility, tool support, and billing rules. No key supplied by runbook. No private inputs.

### Before adding provider key

- [ ] Approve actual test/monthly cash and usage budget, including fees.
- [ ] Disable automatic credit reload; set provider-side cap where available.
- [ ] Choose one explicit model; no automatic fallback/model switching.
- [ ] Create restricted Bifrost virtual key for that provider/model with small test budget.
- [ ] Verify admin and inference authentication remain enforced.
- [ ] Decide how pricing is verified: custom providers may report zero gateway cost. Zero is unknown until corroborated, not free inference.

Use Bifrost UI to add provider credential directly. For Zen custom OpenAI-compatible provider, verify base endpoint and `/v1/chat/completions` path against [Zen docs](https://opencode.ai/docs/zen/) and selected Bifrost release. Configure one model with bounded output and retries; do not reuse old aliases/pricing blindly. If UI/version behavior is unclear, stop and resolve before request.

One synthetic request from guest, using **virtual key**, never provider key in worker/client:

```zsh
# GUEST – one approved paid call; replace model placeholder before execution
read -rs 'BIFROST_TEST_VK?Bifrost test virtual key: '; printf '\n'
# Use stdin for curl configuration so key is not visible in process arguments.
printf 'header = "Authorization: Bearer %s"\n' "$BIFROST_TEST_VK" | \
  curl --config - --fail-with-body http://127.0.0.1:8081/v1/chat/completions \
  -H 'Content-Type: application/json' \
  --data '{"model":"<provider/model>","max_tokens":32,"messages":[{"role":"user","content":"Reply with OK only."}]}'
unset BIFROST_TEST_VK
```

Use generated plain virtual key with no embedded quotes/newlines. Inspect token usage, model resolution, Bifrost cost, and provider billing separately. Allow for billing delay; record unknown until reconciled. Prove restricted model rejection and exhausted-budget rejection using controlled tiny test allowance before any loop. If gateway cannot enforce known prices, no automated worker use; provider cap is not per-run enforcement.

Restart Bifrost and verify UI provider/model state persists. Do not make extra paid requests just to check persistence.

**Checkpoint:** [ ] One manual response. [ ] Actual route understood. [ ] Cost nonzero/verified or explicit block. [ ] Wrong model/key denied. [ ] Budget rejection proven. [ ] No private data.

## Phase 8 – first worker experiment

**Goal:** connect execution only after understanding its permissions and limits.

**Deliberate gate:** baseline contains no custom policy wrapper, sandbox, per-run cost monitor, search tool, or privacy-label enforcement. Multica daemon executes with Unix user's permissions. Native coding tools may read files, run shell, send content externally, and retry. A dedicated user is useful but not complete sandbox. Do not call this a bounded research worker until controls are implemented and tested.

This phase has two parts: create safe identity now; choose/version-check runtime in separate focused session. Do not install unreviewed current binaries from pipe-to-shell commands.

```zsh
# GUEST – dedicated unprivileged identity, no sudo/docker groups
sudo adduser --disabled-password --gecos '' --shell /usr/bin/zsh paos-worker
sudo install -d -o paos-worker -g paos-worker -m 0700 /srv/paos/workspaces
id paos-worker
```

Before runtime installation, write and review version-specific recipe using selected Multica release and supported AI tool documentation. Pin matching Multica CLI; verify release checksum. Verify runtime protocol/flags and gateway compatibility, not UI wording alone. Decide container/separate-worker-VM isolation if tool has general shell; no Docker socket or admin secrets inside execution environment.

### Required acceptance sheet before connecting daemon

| Boundary | Required evidence |
|---|---|
| Identity | Worker has no sudo/docker access; cannot read admin `.env` files |
| Filesystem | Only disposable synthetic workspace available; private files inaccessible |
| Credentials | Only restricted virtual key in runtime; no provider/admin keys; daemon credential scope understood |
| Tools/egress | Enforced allowlist and destinations; prompts/issue labels do not enforce this |
| Privacy | Unknown/private input blocked; no cloud fallback; first issue synthetic/public only |
| Spend | One active run, finite deadline/tools/output, limited retries; verified per-run accounting before adopting $0.50 cap |
| Writes | No sending, purchasing, Git pushes, or destructive actions |
| Cancellation | Actual process/tool subtree stops; no hidden retries/replay |

For learning, proposed limits are 1 active run, 15 minutes, 30 tool calls, 2 transient retries/request. They are targets, **not implemented by this repository**. Set both daemon and agent concurrency to 1. Do not carry old “tests passed” claims into fresh build.

After matching CLI/runtime installation and boundary tests, setup command shape is:

```zsh
# WORKER shell only – review selected CLI --help before running
multica setup self-host --server-url https://paos.<tailnet>.ts.net --app-url https://paos.<tailnet>.ts.net
multica daemon status
```

Setup may start daemon automatically. Configure concurrency before setup, not afterward. Stop with `multica daemon stop` when session ends. Verify runtime appears in web UI; then run exactly one synthetic, read-only task with reviewed capabilities. Inspect UI run timeline and local workspace; test cancellation. Do not enable unattended/autopilot work.

Do not add systemd auto-start, search, memory, or custom enforcement until individual lesson requires it. If runtime decision/control recipe is unfinished, this phase remains blocked and first milestone still stands.

**Checkpoint:** [ ] Runtime recipe reviewed. [ ] Boundaries tested. [ ] One synthetic task. [ ] Cancellation. [ ] Limits evidenced. [ ] Human reviewed output.

## Phase 9 – optional interfaces

Add one interface only when you can state concrete purpose. For each, document auth, state, localhost port, private HTTPS port, allowed peers, health check, and exact undo. Confirm listener unused before Serve publication.

| Interface | Learning purpose | Starting stance |
|---|---|---|
| Open WebUI | Chat interface, distinct from task coordination | Optional separate phase/project; not initial dependency |
| Self-hosted search UI | Search backend behavior | Only after search-provider decision |
| Metrics dashboard | Operational signals | Only when CLI/logs no longer suffice |
| Browser editor/terminal | Remote filesystem/shell | Defer; SSH teaches same VM skills with fewer services |
| Proxmox | Hardware, console, backup/restore | Existing approved admin access; never proxy through worker VM |

Never publish database, Docker socket, internal worker gateway, or worker credentials as “another UI.” Sensitive data remains home-local. GPU VPS is not approved private route.

## Operations and troubleshooting

### Explicit project commands

```zsh
# GUEST – Bifrost only
cd /srv/paos/repo
docker compose -p paos -f compose.yaml --env-file .env ps
docker compose -p paos -f compose.yaml --env-file .env logs --tail=100 bifrost
docker compose -p paos -f compose.yaml --env-file .env stop bifrost
docker compose -p paos -f compose.yaml --env-file .env up -d bifrost

# GUEST – Multica only
cd /srv/paos/repo/vendor/multica
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env ps
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env logs --tail=100 backend
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env stop
docker compose -p multica -f docker-compose.selfhost.yml --env-file .env up -d
```

Logs may contain secrets/content despite configuration intentions; inspect locally and redact before sharing. `stop` keeps containers/state; `down` without `-v` keeps volumes. No `down -v`, pruning, global pulls, secret regeneration, or database downgrade as troubleshooting.

| Symptom | First check | Avoid |
|---|---|---|
| SSH lost | Proxmox console, sshd config, firewall, Tailnet policy | Broadly disabling security remotely |
| HTTPS fails | Local listener → Serve routes → DNS/TLS → effective tailnet policy | Funnel/public bind |
| Multica fails | Local `/readyz`, Postgres/backend status/logs | Treating `/health` as migration proof |
| Login code missing | Backend logs locally; email not configured | Fixed production code or sharing logs |
| Multica wrong daemon URL | Three origin settings; recreate with `up -d` | `restart` expecting new `.env` |
| WebSocket fails | Browser Network and explicit path routes | Testing only root page |
| Bifrost UI edits lost | DB persistence, bootstrap reconciliation, exact image | Blind encryption-key reset |
| Zero model cost | Price mapping and actual provider usage | Assuming budget/free inference works |
| Agent queued | No daemon until Phase 8; runtime/agent concurrency | Starting admin-privileged worker |

### Upgrade one component

Read release notes/security advisories → independent backup → verify restore path → record current digest → choose new version → pull/recreate only affected service → readiness/auth/persistence tests. Multica migrations may be forward-only; restore backup rather than merely downgrade image. Preserve original revision and secrets.

### Session record

Keep real evidence in gitignored `session.local.md` or private notes:

```text
Phase / date:
Goal:
Machine:
Version / image digest:
Change:
Browser observation:
VM observation:
Checkpoint passed / blocked:
Undo / recovery:
What I can explain now:
One next step:
```

## Sources and version-sensitive boundaries

- [Proxmox QEMU/KVM virtual machines](https://pve.proxmox.com/pve-docs/chapter-qm.html): wizard settings, firmware, VirtIO, cache, CPU/memory, and guest agent.
- [Docker Engine on Debian](https://docs.docker.com/engine/install/debian/): apt repository, Debian support, Docker/UFW limitations.
- [Tailscale Debian repository](https://pkgs.tailscale.com/stable/#debian-trixie): installation sources; verify current official instructions.
- [Tailscale Serve CLI](https://tailscale.com/kb/1242/tailscale-serve): private HTTPS proxy and endpoint removal.
- [Tailscale Services](https://tailscale.com/kb/1552/tailscale-services): distinct MagicDNS service names, tagged host requirement, client versions, host approval, service-specific drain/removal.
- [Multica self-host quickstart](https://multica.ai/docs/self-host-quickstart): server/daemon distinction, origins, critical WebSocket routes, readiness, account bootstrap.
- [Multica v0.6.1 Compose](https://github.com/multica-ai/multica/blob/v0.6.1/docker-compose.selfhost.yml): pinned ports, variables, service/volume definitions.
- [Multica daemon/runtimes](https://multica.ai/docs/daemon-runtimes): user permissions, concurrency, credentials, runtime behavior. Live docs may differ from pinned release; inspect chosen CLI/source.
- [Bifrost v2.2.5 gateway setup](https://github.com/maximhq/bifrost/blob/transports/v2.2.5/docs/quickstart/gateway/setting-up.mdx): `/app/data`, configuration database, bootstrap reconciliation, UI persistence.
- [OpenCode Zen](https://opencode.ai/docs/zen/): verify endpoint, pricing, model IDs, recharge and limits before paid phase.

Official sources inform recipes; actual installation checkpoints determine readiness. No historical prototype result counts as evidence for this fresh build.
