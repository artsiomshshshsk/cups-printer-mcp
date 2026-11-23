#!/bin/bash
# Install a boot LaunchDaemon for printer-mcp. Run from anywhere:
#   sudo bash deploy/install-daemon.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$(stat -f %Su "$REPO")"
NODE="$(command -v node)"
LOG="$HOME/Library/Logs/printer-mcp.log"
LABEL=com.printer-mcp
DEST="/Library/LaunchDaemons/$LABEL.plist"

if [ -z "$NODE" ]; then echo "node not found on PATH" >&2; exit 1; fi
if [ ! -f "$REPO/build/index.js" ]; then echo "Run 'npm run build' first" >&2; exit 1; fi

TMP="$(mktemp)"
sed -e "s#__NODE__#$NODE#g" \
    -e "s#__REPO__#$REPO#g" \
    -e "s#__USER__#$OWNER#g" \
    -e "s#__LOG__#$LOG#g" \
    "$REPO/deploy/printer-mcp.plist.template" > "$TMP"

cp "$TMP" "$DEST"
chown root:wheel "$DEST"
chmod 644 "$DEST"
rm -f "$TMP"
mkdir -p "$(dirname "$LOG")"

launchctl bootout "system/$LABEL" 2>/dev/null || true
launchctl bootstrap system "$DEST"
sleep 1
launchctl print "system/$LABEL" | grep -E 'state =|pid =' | head -3
echo "Installed $DEST (runs as $OWNER, logs at $LOG)"
