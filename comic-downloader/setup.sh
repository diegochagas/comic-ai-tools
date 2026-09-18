#!/usr/bin/env bash
# comic-downloader setup (also run by <repo>/setup.sh): installs ./node_modules
# (axios). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

if command -v npm >/dev/null 2>&1; then
    npm install --silent
    echo "node_modules ready: axios $(node -p "require('./node_modules/axios/package.json').version")"
else
    echo "WARNING: npm not found - install Node.js to run scripts/download.cjs."
fi
