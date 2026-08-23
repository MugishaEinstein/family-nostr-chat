#!/bin/sh
set -eu

# The MariaDB service must be healthy before this container starts. Applying the
# checked-in migration is idempotent and guarantees new self-hosted installs
# have the Family Space tables before the API begins serving requests.
./node_modules/.bin/drizzle-kit migrate --config ./drizzle.config.ts
exec node dist/index.js
