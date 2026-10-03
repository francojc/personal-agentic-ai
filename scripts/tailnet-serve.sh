#!/usr/bin/env bash
# Expose Multica over Tailnet HTTPS (tailnet-only; never Funnel) using Multica's single-origin
# routing (self-host quickstart, pinned v0.6.1): /health, /ws, /api/daemon/ws -> backend; rest -> frontend.
# Requires HTTPS certificates enabled for the tailnet. Run on the GUEST.
set -euo pipefail
[[ $EUID -eq 0 ]] || exec sudo -E bash "$0" "$@"
B=http://127.0.0.1:8080; F=http://127.0.0.1:3000
tailscale serve --bg --https=443 --set-path /health "$B/health" >/dev/null
tailscale serve --bg --https=443 --set-path /ws "$B/ws" >/dev/null
tailscale serve --bg --https=443 --set-path /api/daemon/ws "$B/api/daemon/ws" >/dev/null
tailscale serve --bg --https=443 "$F" >/dev/null
tailscale serve status
tailscale funnel status 2>&1 | head -3
