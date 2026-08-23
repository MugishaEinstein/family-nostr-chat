#!/bin/sh
set -eu

: "${RELAY_DOMAIN:?Set RELAY_DOMAIN in .env}"
: "${FAMILY_PUBKEYS:?Set FAMILY_PUBKEYS in .env}"

sed \
  -e "s|__RELAY_URL__|wss://${RELAY_DOMAIN}|g" \
  -e "s|__FAMILY_PUBKEYS__|${FAMILY_PUBKEYS}|g" \
  /app/strfry.conf.template > /app/strfry.conf

exec strfry relay
