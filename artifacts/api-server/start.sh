#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="$SCRIPT_DIR"

echo "Starting FacePay API server on port ${PORT:-8080}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}" --reload
