#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mode="${1:---html-only}"
case "$mode" in
  --html-only|--pdf) ;;
  *) printf 'Usage: %s [--html-only|--pdf]\n' "$0" >&2; exit 1 ;;
esac
command -v marp >/dev/null || { printf 'marp CLI is required.\n' >&2; exit 1; }
mkdir -p dist/assets
cp assets/*.svg assets/*.png dist/assets/
cp ../paos-overview.png ../paos-research.png ../paos-research-loop.png dist/assets/
cp deck.md dist/deck.md
marp --config-file marp.config.mjs dist/deck.md -o dist/deck.html
if [[ "$mode" == --pdf ]]; then
  browser_args=()
  if [[ -n "${MARP_BROWSER_PATH:-}" ]]; then
    browser_args=(--browser-path "$MARP_BROWSER_PATH")
  elif [[ -x /Applications/Helium.app/Contents/MacOS/Helium ]]; then
    browser_args=(--browser-path /Applications/Helium.app/Contents/MacOS/Helium)
  fi
  marp --config-file marp.config.mjs --allow-local-files "${browser_args[@]}" \
    --pdf --pdf-notes --pdf-outlines dist/deck.md -o dist/deck.pdf
fi
printf 'Built PAOS/slides/dist/deck.html\n'
