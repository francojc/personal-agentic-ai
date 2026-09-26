#!/usr/bin/env bash
# Start the optional development layer (devbox + optional agent MCP bridge).
# Usage:
#   ./scripts/dev.sh            # devbox + mcpo agent bridge
#   ./scripts/dev.sh --no-mcp   # devbox only
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "Docker is required."; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required."; exit 1; }

rand(){
  if command -v openssl >/dev/null; then openssl rand -hex 32
  else python3 -c 'import secrets; print(secrets.token_hex(32))'
  fi
}

# The core stack owns .env creation. Bootstrap it if missing.
if [[ ! -f .env ]]; then
  echo "No .env found; running core setup first."
  ./scripts/setup.sh
fi

# Make sure MCPO_API_KEY exists and is not a placeholder.
if ! grep -q '^MCPO_API_KEY=' .env; then
  printf '\nMCPO_API_KEY=%s\n' "$(rand)" >> .env
  echo "Added MCPO_API_KEY to .env."
elif grep -q '^MCPO_API_KEY=GENERATE_ME' .env; then
  sed -i.bak "s/^MCPO_API_KEY=.*/MCPO_API_KEY=$(rand)/" .env
  rm -f .env.bak
  echo "Generated MCPO_API_KEY in .env."
fi

# Create the host workspace directory before bind-mounting it.
set -a; . ./.env; set +a
mkdir -p "${DEV_WORKSPACE:-./workspace}"

profile_args=()
if [[ "${1:-}" == "--no-mcp" ]]; then
  echo "Starting devbox only (MCP bridge disabled)."
else
  profile_args=(--profile mcp)
  echo "Starting devbox + mcp bridge."
fi

# Guard empty-array expansion for bash 3.2 (macOS default).
docker compose -f compose.yaml -f compose.dev.yaml ${profile_args[@]+"${profile_args[@]}"} up -d

printf '\nDev environment:\n'
printf '  code-server (local):  http://localhost:%s\n' "${DEVBOX_LOCAL_PORT:-8443}"
printf '  code-server (tailnet): https://%s.<your-tailnet>.ts.net\n' "${DEVBOX_TS_NAME:-dev}"
printf '  workspace on host:     %s\n' "$(cd "${DEV_WORKSPACE:-./workspace}" && pwd)"
if [[ ${#profile_args[@]} -eq 0 ]]; then
  printf '  mcpo OpenAPI docs:     http://localhost:%s/shell/docs\n' "${MCPO_LOCAL_PORT:-8000}"
  printf '\nRegister the agent tool bridge in Open WebUI:\n'
  printf '  Settings > Admin > Integrations > External Tool Servers\n'
  printf '  Type: OpenAPI | URL: http://mcp:8000/shell | Key: value of MCPO_API_KEY in .env\n'
fi
