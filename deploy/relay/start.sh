#!/bin/sh
set -eu

: "${RELAY_DOMAIN:?Set RELAY_DOMAIN in .env}"
: "${FAMILY_INVITE_CODE:?Set FAMILY_INVITE_CODE in .env}"

sed \
  -e "s|__RELAY_URL__|wss://${RELAY_DOMAIN}|g" \
  /app/strfry.conf.template > /app/strfry.conf

exec strfry --config /app/strfry.conf relay
