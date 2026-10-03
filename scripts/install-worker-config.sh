#!/usr/bin/env bash
# Install PAOS runtime code (root-owned) and worker config/state on the GUEST. Idempotent.
set -euo pipefail
[[ $EUID -eq 0 ]] || exec sudo -E bash "$0" "$@"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
install -d -m 0755 /opt/paos/runtime/extensions /etc/paos
install -m 0755 "$ROOT"/runtime/paos-pi.mjs /opt/paos/runtime/paos-pi.mjs
install -m 0644 "$ROOT"/runtime/{policy,net,monitor,sensitivity,lock,gate,reconcile}.mjs /opt/paos/runtime/
install -m 0644 "$ROOT"/runtime/extensions/paos-research.mjs /opt/paos/runtime/extensions/
[[ -f /etc/paos/worker.json ]] || install -m 0644 "$ROOT/config/paos/worker.json.example" /etc/paos/worker.json  # never overwrite operator edits
install -d -o paos-worker -g paos-worker -m 0700 /var/lib/paos /var/lib/paos/home
install -m 0644 "$ROOT/config/paos/multica-daemon.service" /etc/systemd/system/multica-daemon.service
systemctl daemon-reload
echo "installed. Next: set allowedAgentIds in /etc/paos/worker.json, create /etc/paos/gateway.key (0640 root:paos-worker), then enable multica-daemon."
