#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# EV Asset & Supply Chain Intelligence Platform
# One-command bootstrap for macOS / Linux
# ─────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR=".venv"
VENV_BIN="$VENV_DIR/bin"
PY="$VENV_BIN/python"

echo "→ Backend setup (Python $PYTHON_BIN)"
if [ ! -d "$VENV_DIR" ]; then
    "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
"$VENV_BIN/pip" install --upgrade pip wheel setuptools >/dev/null
"$VENV_BIN/pip" install -r backend/requirements.txt

# Initialize SQLite database
"$PY" -c "import sys; sys.path.insert(0, 'backend'); from database import init_db; init_db()"

echo
echo "→ Frontend setup (Node.js)"
if ! command -v node >/dev/null 2>&1; then
    echo "   Node.js not found. Install Node.js 20+ from https://nodejs.org/" >&2
    exit 1
fi
if [ ! -f frontend/node_modules/.package-lock.json ]; then
    (cd frontend && npm install --include=dev)
fi

# ─── .env bootstrap ─────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo "→ Created .env from .env.example. Fill in the required keys before starting the backend."
else
    echo "→ .env already exists (left untouched)."
fi

echo
echo "✓ Setup complete. Next steps:"
echo "   1. Edit .env and fill in the required API keys (see .env.example for all options)"
echo "   2. Terminal A: cd backend && ../$VENV_BIN/uvicorn main:app --reload --port 8000"
echo "   3. Terminal B: cd frontend && npm run dev"
echo "   4. Open http://localhost:5173 and log in with procurement@demo.com"
