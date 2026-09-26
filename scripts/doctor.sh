#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
printf '%-28s' 'Docker:'; docker info >/dev/null 2>&1 && echo '✓' || echo '✗'
printf '%-28s' 'Compose:'; docker compose version >/dev/null 2>&1 && echo '✓' || echo '✗'
printf '%-28s' 'Containers:'; docker compose ps --status running >/dev/null 2>&1 && echo '✓' || echo '✗'
printf '%-28s' 'Bifrost health:'; curl -fsS http://localhost:${BIFROST_LOCAL_PORT:-8081}/health >/dev/null 2>&1 && echo '✓' || echo '✗'
printf '%-28s' 'Bifrost model endpoint:'; curl -fsS http://localhost:${BIFROST_LOCAL_PORT:-8081}/v1/models >/dev/null 2>&1 && echo '✓' || echo '✗ (normal before provider setup if endpoint requires config)'
printf '%-28s' 'Open WebUI HTTP:'; curl -fsS http://localhost:${OPENWEBUI_LOCAL_PORT:-3000}/ >/dev/null 2>&1 && echo '✓' || echo '✗'
printf '%-28s' 'TSDProxy dashboard:'; curl -fsS http://localhost:${TSDPROXY_LOCAL_PORT:-8080}/ >/dev/null 2>&1 && echo '✓' || echo '✗'
