#!/bin/sh
set -eu

# Self-hosted Compose sets RUN_MIGRATIONS=true after its MariaDB health check.
# Managed production already applies schema migrations through the project DB,
# so running a container-local migration there would block the TCP startup probe.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  ./node_modules/.bin/drizzle-kit migrate --config ./drizzle.config.ts
fi
exec node dist/index.js
