#!/usr/bin/env bash
# Install the L0 seat bundle: verify tailnet + kit CLI, lay the two
# kit skills into the seat workspace, and check the catalog exists.
# Usage: install-seat.sh <seat-workspace-dir> [kit-name]
set -euo pipefail

SEAT_DIR=${1:?usage: install-seat.sh <seat-workspace-dir> [kit-name]}
KIT_NAME=${2:-kit000}
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)

fail() { echo "install-seat: $*" >&2; exit 1; }

echo "== tailnet =="
command -v tailscale >/dev/null || fail "tailscale not found; seats join the company Headscale before anything else"
tailscale status >/dev/null 2>&1 || fail "tailscale is not logged in/online on this seat"
tailscale ip -4 >/dev/null || fail "no tailnet IPv4 on this seat"
echo "seat tailnet ip: $(tailscale ip -4 | head -1)"

echo "== station reachability =="
HOST="${KIT_NAME}.ts.pawswing.app"
if command -v nc >/dev/null; then
  nc -z -w 5 "$HOST" 22 || fail "cannot reach $HOST:22 over the tailnet (check ACL: seat tag -> pawswing-kit:22)"
else
  timeout 5 bash -c "exec 3<>/dev/tcp/$HOST/22" || fail "cannot reach $HOST:22 over the tailnet"
fi
echo "$HOST:22 reachable"

echo "== kit cli =="
command -v kit >/dev/null || fail "kit not on PATH; preinstall the release binary for this architecture (operator machines only, never the station board)"
kit --version

CATALOG=${KIT_CATALOG:-$HOME/.config/kit/catalog.json}
if [ ! -f "$CATALOG" ]; then
  mkdir -p "$(dirname "$CATALOG")"
  sed "s#<SEAT_HOME>#$HOME#" "$REPO_DIR/examples/catalog.example.json" > "$CATALOG"
  echo "wrote catalog template to $CATALOG (fill the real identity_file path after key issuance)"
else
  echo "catalog present: $CATALOG"
fi

echo "== skills =="
mkdir -p "$SEAT_DIR/.agents/skills"
cp -r "$REPO_DIR/skills/pawswing-kit" "$REPO_DIR/skills/pawswing-kit-measure" "$SEAT_DIR/.agents/skills/"
ls "$SEAT_DIR/.agents/skills"

echo "seat bundle installed for $KIT_NAME into $SEAT_DIR"
echo "next: generate the seat kit key, get its fingerprint authorized station-side, then kit list"
