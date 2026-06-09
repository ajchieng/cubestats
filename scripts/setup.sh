#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from the Cubestats root.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[setup] Using Python: $(command -v python3 || true)"

# Create backend virtualenv if missing
if [ ! -d backend/venv ]; then
  echo "[setup] Creating Python virtualenv at backend/venv"
  python3 -m venv backend/venv
fi

echo "[setup] Upgrading pip and installing backend requirements"
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.txt

echo "[setup] Installing frontend npm dependencies"
npm --prefix frontend install

echo "[setup] Done. You can run 'npm run dev' at project root to start both servers."
