#!/usr/bin/env bash
set -euo pipefail

REDIS_URL_VALUE="${REDIS_URL:-redis://127.0.0.1:6379}"

if [[ "${START_LOCAL_REDIS:-false}" == "true" ]] || [[ "$REDIS_URL_VALUE" == redis://127.0.0.1:* ]] || [[ "$REDIS_URL_VALUE" == redis://localhost:* ]]; then
  redis-server --save "" --appendonly no --bind 127.0.0.1 --port 6379 --daemonize yes
fi

exec node apps/worker/dist/index.js
