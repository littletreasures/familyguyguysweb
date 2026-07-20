#!/usr/bin/env bash
set -euo pipefail

# Safe Local Admin App Launcher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "  Family Guy Guys — Admin Tools Launcher"
echo "  Binding: 127.0.0.1:8501 (Localhost Only)"
echo "=========================================================="

if [ ! -f ".env" ]; then
  echo "ERROR: admin-tools/.env file not found."
  echo "Please copy .env.example to .env and configure SUPABASE_URL & SUPABASE_SERVICE_KEY."
  exit 1
fi

streamlit run app.py --server.address 127.0.0.1 --server.port 8501
