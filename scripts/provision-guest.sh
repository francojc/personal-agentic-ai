#!/usr/bin/env bash
# Provision a fresh Debian 13 (trixie) amd64 guest for PAOS. Run on the GUEST as the
# deployment administrator (sudo). Never run on the Proxmox host.
# Sources: docs.docker.com/engine/install/debian, pkgs.tailscale.com/stable (Debian trixie).
set -euo pipefail

[[ "$(. /etc/os-release && echo "$VERSION_CODENAME")" == "trixie" ]] || { echo "Debian 13 required"; exit 1; }
[[ "$(dpkg --print-architecture)" == "amd64" ]] || { echo "amd64 required"; exit 1; }
[[ $EUID -eq 0 ]] || exec sudo -E bash "$0" "$@"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git jq ufw qemu-guest-agent unattended-upgrades

# Docker Engine (official apt repo, deb822 format)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# Tailscale (official stable repo for trixie)
install -m 0755 -d /usr/share/keyrings
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin tailscale

# Docker: bounded logs, no inter-container surprises; set before first container.
install -d /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
EOF

# Identities: paos = deployment admin (sudo, docker). paos-worker = unprivileged, NO sudo/docker.
id paos-worker >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --comment "PAOS worker" paos-worker
passwd -l paos-worker >/dev/null
gpasswd -d paos-worker sudo >/dev/null 2>&1 || true
gpasswd -d paos-worker docker >/dev/null 2>&1 || true
usermod -aG docker paos

# State layout. /srv/paos on the single 96 GiB root filesystem (Docker data stays on same disk).
install -d -o paos -g paos -m 0755 /srv/paos /srv/paos/repo
install -d -o paos -g paos -m 0700 /srv/paos/secrets /srv/paos/backups
install -d -o paos-worker -g paos-worker -m 0700 /srv/paos/workspaces

# SSH: key-only.
cat > /etc/ssh/sshd_config.d/10-paos.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
EOF

systemctl enable --now docker qemu-guest-agent tailscaled
systemctl restart docker ssh

# Host firewall baseline (note: Docker-published ports bypass UFW; compose must bind loopback only).
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow in on tailscale0 >/dev/null
[[ -n "${LAN_CIDR:-}" ]] && ufw allow from "$LAN_CIDR" to any port 22 proto tcp >/dev/null  # optional LAN SSH, e.g. LAN_CIDR=192.168.1.0/24
ufw --force enable >/dev/null

echo "docker:    $(docker --version)"
echo "compose:   $(docker compose version --short)"
echo "tailscale: $(tailscale version | head -1)"
echo "Next: run 'sudo tailscale up --hostname=paos-control' and approve the browser URL."
