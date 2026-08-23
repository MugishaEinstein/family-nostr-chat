# Family Chat

**Family Chat** is a private Nostr messenger with self-service, multi-family hosting on a shared relay. Each household creates an isolated Family Space, manages its own owner-controlled invitations, and exchanges encrypted messages without sharing browser private keys or server credentials.

For Nginx Proxy Manager deployment at `chat.nostr.africa`, follow **[MULTI_FAMILY_SETUP.md](./MULTI_FAMILY_SETUP.md)**. It covers the required MariaDB configuration, the `web:3000` proxy target, Family Space creation, member invitations, isolation tests, upgrades, and backups.

The older single-family setup documents remain only as historical reference. Use the multi-family guide for every new deployment.
