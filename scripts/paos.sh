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

paos()    { docker compose -p paos -f "$ROOT/compose.paos.yaml" --env-file "$SECRETS/paos.env" "$@"; }
multica() { docker compose -p multica --project-directory "$VENDOR" -f "$VENDOR/docker-compose.selfhost.yml" --env-file "$SECRETS/multica.env" "$@"; }
rand()    { openssl rand -hex 32; }
need()    { [[ -f "$SECRETS/$1" ]] || { echo "missing $SECRETS/$1 – run: $0 init-secrets" >&2; exit 1; }; }

usage() { cat <<U
usage: $0 <command> [args]
  vendor-fetch   clone/verify pinned Multica ($MULTICA_TAG @ ${MULTICA_SHA:0:7})
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
  chmod 600 "$SECRETS"/*.env
}

cmd="${1:-}"; shift || true
case "$cmd" in
  vendor-fetch) vendor_fetch ;;
  init-secrets) init_secrets ;;
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
