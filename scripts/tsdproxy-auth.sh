#!/usr/bin/env bash
# Print the latest TSDProxy Tailscale auth URL per hostname from container logs.
# Auth URLs are single-use and regenerate on tsdproxy restart; run this when a
# node reports "interactive login will be required".
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker compose ps --status running --services 2>/dev/null | grep -qx tsdproxy; then
  echo "tsdproxy is not running. Start the stack first: docker compose up -d"
  exit 1
fi

# Only consider the current container run, so stale hostnames from earlier
# configurations do not reappear.
since_args=()
since=$(docker inspect -f '{{.State.StartedAt}}' tsdproxy 2>/dev/null || true)
if [[ -n "$since" ]]; then since_args=(--since "$since"); fi

# TSDProxy log lines contain ANSI color codes (e.g. "Hostname=\033[0mai"), so
# strip escapes before matching fields.
docker compose -f compose.yaml logs ${since_args[@]+"${since_args[@]}"} tsdproxy 2>&1 | awk '
  {
    gsub(/\033\[[0-9;]*m/, "", $0)
    if ($0 ~ /login\.tailscale\.com\/a\//) {
      if (match($0, /https:\/\/login\.tailscale\.com\/a\/[A-Za-z0-9]+/)) {
        url = substr($0, RSTART, RLENGTH)
      }
      if (match($0, /Hostname=[A-Za-z0-9_.-]+/)) {
        host = substr($0, RSTART + 9, RLENGTH - 9)
        if (url != "") last[host] = url
      }
    }
  }
  END {
    found = 0
    for (h in last) { printf "%-12s %s\n", h, last[h]; found = 1 }
    if (!found) {
      print "No pending auth URLs found."
      print "Either all nodes are authenticated, or the stack just started."
      print "Try: docker compose -f compose.yaml restart tsdproxy && sleep 8 && ./scripts/tsdproxy-auth.sh"
    }
  }
'
