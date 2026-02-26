#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-noon-feed-web}"
CONFIG_FILE="${CONFIG_FILE:-fly.feed.toml}"
CREATE_APP_IF_MISSING="${CREATE_APP_IF_MISSING:-false}"

if ! command -v flyctl >/dev/null 2>&1; then
  if [ -x "$HOME/.fly/bin/flyctl" ]; then
    export PATH="$HOME/.fly/bin:$PATH"
  fi
fi

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl not found. Install from https://fly.io/docs/flyctl/install/"
  exit 1
fi

echo "Deploying app: ${APP_NAME}"
echo "Config file:   ${CONFIG_FILE}"

if [ "${CREATE_APP_IF_MISSING}" = "true" ]; then
  flyctl status -a "${APP_NAME}" >/dev/null 2>&1 || flyctl apps create "${APP_NAME}"
fi
flyctl deploy -a "${APP_NAME}" -c "${CONFIG_FILE}" --remote-only

echo "Deployment complete. Current machines:"
flyctl machine list -a "${APP_NAME}"
