#!/usr/bin/env bash
set -euo pipefail

redis-server --save "" --appendonly no --bind 127.0.0.1 --port 6379 --daemonize yes

exec node apps/worker/dist/index.js
