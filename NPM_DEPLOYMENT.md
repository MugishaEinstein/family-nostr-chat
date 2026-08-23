# Nginx Proxy Manager Deployment: Family Chat

For the active `chat.nostr.africa` installation, use **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** as the single source of truth. It includes your confirmed NPM network (`nginx-proxy-manager_default`), the two proxy hosts, one-time invite-code enrollment, recipient-directory setup, testing, updates, and backups.

> Use `docker-compose.npm.yml` only. The normal `docker-compose.yml` starts Caddy and is not for an NPM-managed server.

The two NPM upstreams are `web:80` for `chat.nostr.africa` and `relay:7777` for `relay.chat.nostr.africa`; enable **Websockets Support** for the relay host.
