# Giant deployment snapshot

The active self-hosted stack uses `docker-compose.npm.yml` with three private services: `web` on port 3000, `relay` on port 7777, and a MariaDB 11.4 database. It joins the confirmed external Nginx Proxy Manager network `nginx-proxy-manager_default`; NPM must forward the public application host to `web:3000` and the WebSocket relay host to `relay:7777`. The web service runs migrations only in Compose (`RUN_MIGRATIONS=true`) after the database health check passes.
