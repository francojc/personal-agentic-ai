#!/usr/bin/env bash
# Install pinned worker runtime on the Debian 13 GUEST: Node 22 (checksum-verified tarball),
# Pi (npm, --ignore-scripts, exact version), Multica CLI (checksum-verified release), bubblewrap.
# Root-owned under /opt/paos so the unprivileged worker cannot modify it.
set -euo pipefail
[[ $EUID -eq 0 ]] || exec sudo -E bash "$0" "$@"

NODE_VERSION="${NODE_VERSION:-v22.23.3}"
PI_VERSION="1.0.1"
MULTICA_VERSION="0.6.1"
OPT=/opt/paos
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq bubblewrap >/dev/null
install -d -m 0755 "$OPT" "$OPT/bin"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# Node: verify SHA-256 from nodejs.org SHASUMS256.txt (same TLS origin; GPG signature not checked).
if [[ ! -x "$OPT/node/bin/node" ]]; then
  f="node-$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$f" -o "$tmp/$f"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " $f\$" SHASUMS256.txt | sha256sum -c -)
  mkdir -p "$OPT/node" && tar -xJf "$tmp/$f" -C "$OPT/node" --strip-components=1
fi
export PATH="$OPT/node/bin:$PATH"

# Pi: exact version, no lifecycle scripts, private prefix.
if [[ ! -x "$OPT/pi/bin/pi" ]]; then
  npm install -g --ignore-scripts --prefix "$OPT/pi" "@earendil-works/pi-coding-agent@$PI_VERSION" >/dev/null
fi

# Multica CLI: verify against release checksums.txt.
if [[ ! -x "$OPT/bin/multica" ]]; then
  base="https://github.com/multica-ai/multica/releases/download/v$MULTICA_VERSION"
  f="multica-cli-$MULTICA_VERSION-linux-amd64.tar.gz"
  curl -fsSL "$base/$f" -o "$tmp/$f"; curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt"
  (cd "$tmp" && grep " $f\$" checksums.txt | sha256sum -c -)
  tar -xzf "$tmp/$f" -C "$tmp"; install -m 0755 "$(find "$tmp" -name multica -type f | head -1)" "$OPT/bin/multica"
fi

chown -R root:root "$OPT"; chmod -R go-w "$OPT"
echo "node:      $("$OPT/node/bin/node" --version)"
echo "pi:        $("$OPT/node/bin/node" "$OPT/pi/bin/pi" --version 2>&1 | head -1)"
echo "multica:   $("$OPT/bin/multica" version 2>&1 | head -1)"
echo "bwrap:     $(bwrap --version)"
