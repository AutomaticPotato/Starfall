#!/usr/bin/env bash
# Community installer for Linux and Windows through WSL2. See docs/installation.md.
# Disable inherited tracing before handling configuration; credentials never enter shell variables.
set +x
set -euo pipefail
command -v python3 >/dev/null || {
  echo 'Python 3 is required. See docs/installation.md for Linux/WSL prerequisites.' >&2
  exit 1
}
cd -- "$(dirname -- "$0")"
exec python3 ./installer.py "$@"
