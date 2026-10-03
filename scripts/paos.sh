#!/usr/bin/env bash
# PAOS lifecycle wrapper. Drives TWO explicit Compose projects: "paos" (this repo) and
# "multica" (pinned vendor checkout). Do not run bare `docker compose` against either.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${PAOS_SECRETS_DIR:-/srv/paos/secrets}"
VENDOR="$ROOT/vendor/multica"
MULTICA_REPO="https://github.com/multica-ai/multica.git"
MULTICA_TAG="v0.6.1"
MULTICA_SHA="2ea01ae4ef55de4310b99af192d2dbd367832883"

paos()    { docker compose -p paos -f "$ROOT/compose.paos.yaml" ${PAOS_EXTRA_COMPOSE:+-f "$ROOT/$PAOS_EXTRA_COMPOSE"} --env-file "$SECRETS/paos.env" "$@"; }  # PAOS_EXTRA_COMPOSE: tests only
multica() { docker compose -p multica --project-directory "$VENDOR" -f "$VENDOR/docker-compose.selfhost.yml" --env-file "$SECRETS/multica.env" "$@"; }
rand()    { openssl rand -hex 32; }
need()    { [[ -f "$SECRETS/$1" ]] || { echo "missing $SECRETS/$1 – run: $0 init-secrets" >&2; exit 1; }; }

usage() { cat <<U
usage: $0 <command> [args]
  vendor-fetch   clone/verify pinned Multica ($MULTICA_TAG @ ${MULTICA_SHA:0:7})
  sync-worker-key  install the worker's gateway virtual key to /etc/paos/gateway.key
  init-secrets   create $SECRETS/{paos,multica}.env (0600) if absent; never overwrites
  config         validate both projects (secrets masked; output not stored)
  up | stop | down [paos|multica|all]   default all; 'down' never removes volumes
  status         ps for both projects
  logs <paos|multica> [service]
Order: up starts paos first, then multica; stop reverses it.
U
}

vendor_fetch() {
  mkdir -p "$ROOT/vendor"
  [[ -d "$VENDOR/.git" ]] || git clone --quiet "$MULTICA_REPO" "$VENDOR"
  git -C "$VENDOR" fetch --quiet --tags origin
  git -C "$VENDOR" checkout --quiet "$MULTICA_TAG"
  [[ "$(git -C "$VENDOR" rev-parse HEAD)" == "$MULTICA_SHA" ]] || { echo "Multica tag $MULTICA_TAG does not match pinned $MULTICA_SHA" >&2; exit 1; }
  echo "Multica $MULTICA_TAG verified at $MULTICA_SHA"
}

init_secrets() {
  umask 077; mkdir -p "$SECRETS"
  if [[ ! -f "$SECRETS/paos.env" ]]; then
    sed "s/^BIFROST_ENCRYPTION_KEY=.*/BIFROST_ENCRYPTION_KEY=$(rand)/" "$ROOT/paos.env.example" > "$SECRETS/paos.env"
    echo "created $SECRETS/paos.env"
  fi
  if [[ ! -f "$SECRETS/multica.env" ]]; then
    local pg; pg="$(rand)"
    cat > "$SECRETS/multica.env" <<E
# Multica self-host settings (loopback bindings come from the vendor compose file).
MULTICA_IMAGE_TAG=$MULTICA_TAG
POSTGRES_PASSWORD=$pg
JWT_SECRET=$(rand)
APP_ENV=production
ALLOW_SIGNUP=false
FRONTEND_ORIGIN=http://localhost:3000
MULTICA_APP_URL=http://localhost:3000
E
    echo "created $SECRETS/multica.env (set FRONTEND_ORIGIN/MULTICA_APP_URL when the Tailnet URL is chosen, step 9)"
  fi
  # Idempotently add gateway credentials introduced after first init (never overwrites existing values).
  ensure() { grep -q "^$1=" "$SECRETS/paos.env" || echo "$1=$2" >> "$SECRETS/paos.env"; }
  ensure BIFROST_ADMIN_USERNAME paos-admin
  ensure BIFROST_ADMIN_PASSWORD "$(rand)"
  ensure PAOS_WORKER_VK "sk-bf-$(rand)"
  ensure GATEWAY_FILTER_PORT 8082
  chmod 600 "$SECRETS"/*.env
}

# Install the worker's gateway virtual key where the launcher reads it (root:paos-worker 0640).
sync_worker_key() {
  need paos.env
  local vk; vk="$(grep '^PAOS_WORKER_VK=' "$SECRETS/paos.env" | cut -d= -f2-)"
  [[ -n "$vk" ]] || { echo "PAOS_WORKER_VK empty" >&2; exit 1; }
  sudo install -d -m 0755 /etc/paos
  printf '%s\n' "$vk" | sudo install -m 0640 -o root -g paos-worker /dev/stdin /etc/paos/gateway.key
  echo "installed /etc/paos/gateway.key"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  vendor-fetch) vendor_fetch ;;
  init-secrets) init_secrets ;;
  sync-worker-key) sync_worker_key ;;
  config) need paos.env; need multica.env; [[ -d "$VENDOR" ]] || { echo "run vendor-fetch" >&2; exit 1; }
          paos config --quiet && echo "paos: ok"; multica config --quiet && echo "multica: ok" ;;
  up)     need paos.env; need multica.env; t="${1:-all}"
          [[ $t == multica ]] || paos up -d
          [[ $t == paos ]] || multica up -d ;;
  stop)   t="${1:-all}"; [[ $t == paos ]] || multica stop; [[ $t == multica ]] || paos stop ;;
  down)   t="${1:-all}"; [[ $t == paos ]] || multica down; [[ $t == multica ]] || paos down ;;  # never -v
  status) paos ps; multica ps ;;
  logs)   p="${1:?paos|multica}"; shift; "$p" logs --tail=100 "$@" ;;
  *)      usage; exit 1 ;;
esac
