#!/bin/sh
# Plays the arcade from a tiny local web server (needs Python 3).
# You don't need this: opening index.html works too. The server just makes
# sure every browser shares your coins between the games.
cd "$(dirname "$0")" || exit 1
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
  echo "Python isn't installed, so just open index.html in your browser."
  exit 1
fi
(sleep 1; if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:8000/; else open http://localhost:8000/; fi) >/dev/null 2>&1 &
echo "Arcade running at http://localhost:8000/  (Ctrl+C to stop)"
exec "$PY" -m http.server 8000
