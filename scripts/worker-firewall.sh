#!/usr/bin/env bash
# Egress policy for the unprivileged worker uid (Multica daemon + launcher + sandboxed Pi share it).
# Allows: DNS via local stub, filtered gateway :8082, this host's own Tailnet HTTPS (daemon -> Multica),
# and public web 80/443. Rejects everything internal: loopback admin ports (Bifrost :8081, Multica
# :8080/:3000), LAN, Docker bridges, other Tailnet peers, link-local. Idempotent; run on the GUEST.
# NOTE: Docker-published ports bypass UFW, so this uses iptables owner matching (iptables-nft).
set -euo pipefail
[[ $EUID -eq 0 ]] || exec sudo -E bash "$0" "$@"
USER_NAME=paos-worker
TS_IP4="$(tailscale ip -4 | head -1)"
[[ -n "$TS_IP4" ]] || { echo "tailscale IPv4 not found" >&2; exit 1; }
CHAIN=PAOS_WORKER

apply() { # $1 = iptables|ip6tables
  local ipt=$1
  $ipt -N $CHAIN 2>/dev/null || $ipt -F $CHAIN
  $ipt -C OUTPUT -m owner --uid-owner "$USER_NAME" -j $CHAIN 2>/dev/null || $ipt -I OUTPUT 1 -m owner --uid-owner "$USER_NAME" -j $CHAIN
  $ipt -A $CHAIN -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
}

apply iptables
I=iptables; C=$CHAIN
$I -A $C -o lo -d 127.0.0.53 -p udp --dport 53 -j ACCEPT
$I -A $C -o lo -d 127.0.0.53 -p tcp --dport 53 -j ACCEPT
$I -A $C -o lo -d 127.0.0.1 -p tcp --dport 8082 -j ACCEPT          # filtered gateway only
$I -A $C -d "$TS_IP4" -p tcp --dport 443 -j ACCEPT                 # daemon -> own Tailnet HTTPS (Multica)
for net in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
  $I -A $C -d $net -j REJECT
done
$I -A $C -p tcp -m multiport --dports 80,443 -j ACCEPT              # public web
$I -A $C -j REJECT

apply ip6tables
I=ip6tables
$I -A $C -o lo -d ::1 -p tcp --dport 8082 -j ACCEPT 2>/dev/null || true
$I -A $C -d 2000::/3 -p tcp -m multiport --dports 80,443 -j ACCEPT # public IPv6 web only (fc00::/7, fe80::/10, ::1 rejected)
$I -A $C -j REJECT

echo "worker egress policy applied for uid $USER_NAME (tailnet self $TS_IP4)"
