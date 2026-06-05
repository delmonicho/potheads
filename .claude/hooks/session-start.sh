#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install dependencies so build/lint work. .npmrc sets legacy-peer-deps=true
# (required for vite-plugin-pwa). npm install is idempotent and caches well.
npm install
