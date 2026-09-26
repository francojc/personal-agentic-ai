#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo "Docker is required."; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required."; exit 1; }
rand(){ if command -v openssl >/dev/null; then openssl rand -hex 32; else python3 -c 'import secrets; print(secrets.token_hex(32))'; fi; }
if [[ ! -f .env ]]; then
  cp .env.example .env
  w=$(rand); b=$(rand); m=$(rand)
  sed -i.bak "s/^WEBUI_SECRET_KEY=.*/WEBUI_SECRET_KEY=$w/" .env
  sed -i.bak "s/^BIFROST_ENCRYPTION_KEY=.*/BIFROST_ENCRYPTION_KEY=$b/" .env
  sed -i.bak "s/^MCPO_API_KEY=.*/MCPO_API_KEY=$m/" .env
  rm -f .env.bak
  chmod 600 .env 2>/dev/null || true
  echo "Created .env with persistent random secrets."
fi
if grep -q 'GENERATE_ME' .env; then echo "ERROR: .env still contains GENERATE_ME."; exit 1; fi
docker compose pull
docker compose up -d
printf '\nLocal bootstrap URLs:\n  TSDProxy:   http://localhost:%s\n  Open WebUI: http://localhost:%s\n  Bifrost:    http://localhost:%s\n\nNext: authenticate TSDProxy/Tailscale, add a provider in Bifrost, then open Open WebUI.\n' "${TSDPROXY_LOCAL_PORT:-8080}" "${OPENWEBUI_LOCAL_PORT:-3000}" "${BIFROST_LOCAL_PORT:-8081}"
