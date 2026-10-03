#!/usr/bin/env bash
# Run ONE synthetic public issue through the live stack against the scripted mock (TEST MODE only).
# usage: tests/e2e-run.sh <mock-mode> [delay_ms] [fail_first] [timeout_s] [extra label names...]
# Prints terminal status/error, PAOS log tail, ledger line and mock request count. Run on the guest as `paos`.
set -u
MODE=${1:-research}; DELAY=${2:-0}; FAIL=${3:-0}; TMO=${4:-90}
M="sudo -u paos-worker env HOME=/var/lib/paos/home /opt/paos/bin/multica"
AID=$($M agent list --output json | jq -r '.[] | select(.name=="Research Scout") | .id')
LBL() { $M label list --output json | jq -r --arg n "$1" '.[] | select(.name==$n) | .id'; }
docker rm -f paos-mock-zen >/dev/null 2>&1
docker run -d --name paos-mock-zen --network paos_net --read-only --cap-drop ALL --security-opt no-new-privileges \
  -v /srv/paos/repo/tests/mock:/m:ro -e MOCK_MODE="$MODE" -e MOCK_DELAY_MS="$DELAY" -e MOCK_FAIL_FIRST="$FAIL" node:22-alpine node /m/mock-zen.mjs >/dev/null
sleep 2
ISSUE=$($M issue create --title "e2e $MODE d=$DELAY f=$FAIL" --description "synthetic" --output json | jq -r .id)
$M issue label add "$ISSUE" "$(LBL public)" --output json >/dev/null
$M issue assign "$ISSUE" --to-id "$AID" >/dev/null 2>&1
echo "$ISSUE" > /tmp/e2e.issue
for _ in $(seq 1 "$TMO"); do
  st=$($M issue runs "$ISSUE" --output json | jq -r '.[0].status // "none"')
  case "$st" in completed|failed|cancelled) break;; esac; sleep 1
done
echo "status=$st error=$($M issue runs "$ISSUE" --output json | jq -r '.[0].error // ""')"
sudo bash -c 'tail -3 /var/lib/paos/runs/*.jsonl' | jq -c '{type,reason,tool_calls,turns,cost_usd}' | tail -3
sudo tail -1 /var/lib/paos/ledger.jsonl | jq -c '{status,cost_usd}'
echo "mock requests: $(docker exec paos-mock-zen wget -qO- http://127.0.0.1:9099/__calls | jq length)"
