#!/usr/bin/env bash
# =============================================================================
# KSP Crime Intelligence Copilot — one-command launcher
# Usage:  ./start.sh [port]      (default port 8000)
# =============================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8000}"
URL="http://localhost:${PORT}"
cd "$DIR"

echo "🛡️  KSP Crime Intelligence Copilot"
echo "    Serving: $DIR"
echo "    URL    : $URL   (use this — not the file:// path — so voice works)"
echo "    Stop   : press Ctrl+C"
echo ""

# Open the browser shortly after the server comes up.
( sleep 1.2
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v start >/dev/null 2>&1; then start "$URL"
  fi ) >/dev/null 2>&1 &

# Start a static server (Python 3 preferred; falls back gracefully).
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$DIR/serve.py" "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" "$DIR"
else
  echo "❌ Need Python 3 (or Node/npx). Install Python from https://python.org and re-run."
  exit 1
fi
