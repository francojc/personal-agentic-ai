#!/usr/bin/env bash
# Compose slides/src/*.md into one deck, then render with Marp.
# Output in dist/ is self-contained (deck + assets), so it can be shared as a folder.
#
# Usage:
#   ./build.sh              # HTML, then PDF if a browser is available (soft failure)
#   ./build.sh --html-only  # HTML only
#   ./build.sh --pdf        # HTML + PDF, PDF failure is fatal
#   ./build.sh --docker-pdf # HTML locally, PDF via the marp-cli container
set -euo pipefail
cd "$(dirname "$0")"

command -v marp >/dev/null || {
  echo "marp CLI is required: npm i -g @marp-team/marp-cli"
  exit 1
}

mkdir -p dist

# Marp accepts Chromium-based browsers through --browser-path. Helium ships a
# Chromium executable but is not in Marp's automatic browser discovery list.
browser_args=()
if [[ -n "${MARP_BROWSER_PATH:-}" ]]; then
  browser_args=(--browser-path "$MARP_BROWSER_PATH")
elif [[ "$(uname -s)" == Darwin && -x "/Applications/Helium.app/Contents/MacOS/Helium" ]]; then
  browser_args=(--browser-path "/Applications/Helium.app/Contents/MacOS/Helium")
fi

# Copy assets so relative paths (assets/...) resolve inside dist/.
rm -rf dist/assets
cp -R assets dist/assets

# Compose fragments in filename order. Only 00-title.md carries frontmatter;
# every later fragment begins with a '---' slide separator.
: > dist/deck.md
for f in src/*.md; do
  command cat "$f" >> dist/deck.md
  printf '\n' >> dist/deck.md
done

# HTML: self-contained folder, shareable, works offline.
marp --config-file ./marp.config.mjs --allow-local-files dist/deck.md -o dist/deck.html

mode="${1:-auto}"

build_pdf_local() {
  marp --config-file ./marp.config.mjs --allow-local-files "${browser_args[@]}" \
    --pdf --pdf-notes --pdf-outlines dist/deck.md -o dist/deck.pdf
}

build_pdf_docker() {
  docker run --rm --init \
    -v "$PWD":/home/marp/app -w /home/marp/app \
    marpteam/marp-cli:latest \
    --config-file ./marp.config.mjs --allow-local-files \
    --pdf --pdf-notes --pdf-outlines dist/deck.md -o dist/deck.pdf
}

case "$mode" in
  --html-only)
    ;;
  --docker-pdf)
    build_pdf_docker
    printf '\nBuilt:\n  slides/dist/deck.html\n  slides/dist/deck.pdf (via container)\n  slides/dist/assets/\n'
    exit 0
    ;;
  --pdf)
    build_pdf_local
    printf '\nBuilt:\n  slides/dist/deck.html\n  slides/dist/deck.pdf\n  slides/dist/assets/\n'
    exit 0
    ;;
  auto)
    if build_pdf_local 2>/dev/null; then
      printf '\nBuilt:\n  slides/dist/deck.html\n  slides/dist/deck.pdf\n  slides/dist/assets/\n'
    else
      printf '\nBuilt: slides/dist/deck.html (and dist/assets/)\n'
      printf '\nPDF skipped: no supported browser found (chrome, edge, or firefox).\n'
      printf 'Options:\n'
      printf '  - Install Chrome, Edge, or Firefox, then run: ./build.sh --pdf\n'
      printf '  - Or build PDF via the container:             ./build.sh --docker-pdf\n'
    fi
    ;;
  *)
    echo "Unknown option: $mode"
    echo "Use --html-only, --pdf, or --docker-pdf."
    exit 1
    ;;
esac
