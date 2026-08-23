# Family Chat Deployment Checklist

| Check | Expected result |
| --- | --- |
| DNS | Both `chat.nostr.africa` and `relay.chat.nostr.africa` resolve to `giant`. |
| NPM network | `NPM_NETWORK=nginx-proxy-manager_default` in `.env`. |
| Relay secret | `FAMILY_INVITE_CODE` is a long private value in `.env`. |
| Compose | `docker compose -f docker-compose.npm.yml ps` shows `web` and `relay` running. |
| NPM hosts | `web:80` and `relay:7777` use valid TLS; relay Websockets Support is enabled. |
| First device | Creating a browser key with the invite code ends at **Private relay**. |
| Second device | It joins with the same invite code and sends/receives a fresh test message. |
| People directory | Every device lists every other participant before family messaging begins. |
| Backup | The relay volume has a tested, dated archive. |

Detailed instructions: **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.
