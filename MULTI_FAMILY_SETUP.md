# Family Chat: Multi-Family Setup Guide

Family Chat now supports **self-service Family Spaces** on one shared Nostr relay. A family owner creates a private space in the browser, receives an invite code, and controls its membership. The relay checks a signed family-space identifier on each encrypted gift-wrap and permits it only when both the authenticated sender and recipient belong to that space.

> The database stores family names, membership, invitation state, and an audit trail. It does **not** store message content or Nostr private keys. Each device keeps its private key in its own browser.

## 1. What changes from the older release

The previous single-family deployment used `FAMILY_INVITE_CODE` and a simple JSON membership file. The multi-family release replaces that with a local MariaDB service and server-managed Family Spaces. Existing one-family device keys are still local to each browser; create a new Family Space and invite each device after updating.

| Component | Earlier release | Multi-family release |
| --- | --- | --- |
| Enrollment | One server-wide invite code | Owner-created Family Space invitations |
| Membership | Shared relay JSON file | Database source of truth plus relay cache |
| Relay destination | One household | Shared relay, signed family-space tags |
| Web upstream in NPM | `web:80` | **`web:3000`** |

## 2. Update the server

Run this on `giant`. If your earlier clone is `~/hearthline`, keep that location; the folder name does not affect the running service.

```bash
cd ~/hearthline
git pull --ff-only

cp env.template .env
nano .env
```

Use the confirmed NPM network and domains. Generate two different database passwords on the server before placing them in `.env`.

```bash
openssl rand -hex 32
openssl rand -hex 32
```

```dotenv
APP_DOMAIN=chat.nostr.africa
RELAY_DOMAIN=relay.chat.nostr.africa
NPM_NETWORK=nginx-proxy-manager_default
DB_PASSWORD=<first-generated-value>
DB_ROOT_PASSWORD=<second-generated-value>
```

Build and start the application, relay, and local database. In this self-hosted Compose stack, the web container applies its checked-in database migration after MariaDB reports healthy. Managed Family Chat hosting uses its project database migration separately and does not run container-start migrations.

```bash
docker compose -f docker-compose.npm.yml up -d --build
docker compose -f docker-compose.npm.yml ps
docker compose -f docker-compose.npm.yml logs --tail=100 web relay database
```

## 3. Update Nginx Proxy Manager

Keep both existing NPM proxy hosts and certificates, but edit the **web application** proxy host because Family Chat is now a Node server rather than a static-file container.

| NPM setting | `chat.nostr.africa` | `relay.chat.nostr.africa` |
| --- | --- | --- |
| Forward hostname | `web` | `relay` |
| Forward port | **`3000`** | `7777` |
| Websockets Support | Optional | **Enabled** |
| Force SSL | Enabled | Enabled |

The relay host keeps its existing advanced timeouts:

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Verify both public endpoints:

```bash
curl -I https://chat.nostr.africa
curl -H 'Accept: application/nostr+json' https://relay.chat.nostr.africa
```

## 4. Create the first Family Space

Open `https://chat.nostr.africa` and choose **Create a space**. Enter a name for the owner device, a Family Space name, and `wss://relay.chat.nostr.africa`. Family Chat generates a device-local Nostr key and makes that key the Family Space owner. The first invite code is copied to the clipboard.

Share that code only with relatives you want to join. It is not a server password; it is a limited, revocable family invitation. Create a fresh code at any time from **People → Create invite code**.

## 5. Let another family create its own space

Another household simply visits the same `https://chat.nostr.africa` address and selects **Create a space**. Their owner key, invites, members, and encrypted room events are scoped to their own Family Space. They do not need access to your server or Nginx Proxy Manager.

## 6. Join an existing Family Space

A relative selects **Join with invite**, enters their display name and the owner’s invite code, and creates or imports a device key. The server verifies the signed device request and updates the relay’s read-only membership cache. The new device then reconnects to the shared relay as an authorized family member.

## 7. Test isolation and two-way delivery

Test this before inviting many people. In Family A, send a fresh message between two members. Then create Family B in another browser profile, invite a second Family B device, and exchange a second message. Members of Family A must never receive Family B messages, and each family’s **People** dialog must list only their own members.

The relay’s metadata can observe that encrypted events are routed through the shared relay. Message contents remain encrypted end-to-end, while the server/relay enforce membership and recipient scoping.

## 8. Routine operations and backups

| Task | Command |
| --- | --- |
| View services | `cd ~/hearthline && docker compose -f docker-compose.npm.yml ps` |
| Follow application log | `cd ~/hearthline && docker compose -f docker-compose.npm.yml logs -f web` |
| Follow relay policy log | `cd ~/hearthline && docker compose -f docker-compose.npm.yml logs -f relay` |
| Update release | `git pull --ff-only && docker compose -f docker-compose.npm.yml up -d --build` |

Back up both MariaDB and the relay volume. The database is the authority for Family Spaces and membership; `family_state` is a rebuildable relay cache.

```bash
cd ~/hearthline
docker compose -f docker-compose.npm.yml exec -T database \
  mariadb-dump -u root -p"$DB_ROOT_PASSWORD" familychat > familychat-$(date +%F).sql
docker run --rm -v hearthline_relay_data:/data -v "$PWD":/backup alpine \
  tar -czf /backup/family-chat-relay-$(date +%F).tgz -C /data .
```

## 9. Security operations

Family owners should remove a member from **People** when a device is lost or a person leaves. This removes future relay authorization for that key; it cannot erase encrypted copies that another member already received. Rotate or revoke invitations if a code was shared beyond the intended household.

## References

[1]: https://nips.nostr.com/29 "NIP-29: Relay-based Groups"
[2]: https://nips.nostr.com/98 "NIP-98: HTTP Auth"
