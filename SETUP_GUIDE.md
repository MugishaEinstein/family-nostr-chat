# Family Chat Setup Guide

This guide deploys **Family Chat** on `giant` using your existing Nginx Proxy Manager (NPM) network, `nginx-proxy-manager_default`. The web app uses `chat.nostr.africa`; the private Nostr relay uses `relay.chat.nostr.africa`.

> A family member enters a **private invite code** once. Family Chat creates a browser-held Nostr key and the relay enrolls that public key automatically. No one needs to send, copy, or enter a hexadecimal public key on the server.[1] [2]

## 1. DNS and prerequisites

Create these DNS records at the provider for `nostr.africa`, both pointing to `giant`’s public IPv4 address.

| Hostname | Purpose |
| --- | --- |
| `chat.nostr.africa` | Family Chat web app |
| `relay.chat.nostr.africa` | Private `wss://` relay |

NPM should be the only service exposed on ports `80` and `443`. Do not expose the relay’s internal port `7777` on the host.

Confirm the existing NPM Docker network:

```bash
docker network ls | grep nginx-proxy-manager_default
docker ps --format 'table {{.Names}}\t{{.Networks}}' | grep nginx-proxy-manager
```

## 2. New installation

For a fresh server installation, run:

```bash
cd ~
git clone https://github.com/MugishaEinstein/family-nostr-chat.git family-chat
cd ~/family-chat
cp env.template .env
```

Create a long random invite code and place it in `.env`. Share this code only with relatives who should be able to join.

```bash
INVITE_CODE=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
printf 'Family invite code: %s\n' "$INVITE_CODE"

cat > .env <<EOF
APP_DOMAIN=chat.nostr.africa
RELAY_DOMAIN=relay.chat.nostr.africa
NPM_NETWORK=nginx-proxy-manager_default
FAMILY_INVITE_CODE=$INVITE_CODE
FAMILY_PUBKEYS=
EOF
```

Store the displayed code in a password manager or share it through a trusted channel. It is an enrollment secret, not a browser key. If it is exposed, change `FAMILY_INVITE_CODE` and recreate the relay before inviting anyone else.

Start the application and relay. Use the NPM-specific file; do **not** run the Caddy-based `docker-compose.yml`.

```bash
cd ~/family-chat
docker compose -f docker-compose.npm.yml up -d --build
docker compose -f docker-compose.npm.yml ps
docker compose -f docker-compose.npm.yml logs --tail=100 web relay
```

## 3. Configure Nginx Proxy Manager

In NPM, select **Hosts → Proxy Hosts → Add Proxy Host**. Create both entries below. Request a new Let’s Encrypt certificate for each, then enable **Force SSL**, **HTTP/2 Support**, and **Block Common Exploits**.

| NPM field | Web app | Relay |
| --- | --- | --- |
| Domain Names | `chat.nostr.africa` | `relay.chat.nostr.africa` |
| Scheme | `http` | `http` |
| Forward Hostname / IP | `web` | `relay` |
| Forward Port | `80` | `7777` |
| Websockets Support | Optional | **Enabled** |

For the relay proxy host, add the following to the **Advanced** tab. Leave manual `Upgrade` and `Connection` headers out; NPM manages them when Websockets Support is enabled.[3]

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Validate public routing:

```bash
curl -I https://chat.nostr.africa
curl -H 'Accept: application/nostr+json' https://relay.chat.nostr.africa
```

The relay request should return its NIP-11 information document in JSON.[4]

## 4. Join the first device

On the first device, open `https://chat.nostr.africa`. Enter a display name, then enter:

```text
Family relay: wss://relay.chat.nostr.africa
Family invite code: <the private code from .env>
```

Select **Set a key at this place**. Family Chat creates the browser key locally, signs the relay’s NIP-42 authentication challenge, submits a hashed invite-code claim, and then subscribes to the private room. The final room header should show a green dot and **Private relay**.[1] [2]

The browser key remains on that device. Do not copy or share an `nsec` private key.

## 5. Join every family member

Each person repeats the first-device process on their own browser or device. Give them only the relay address and the current invite code. They do not need to send any hexadecimal public key to the administrator.

After joining, each device must still open **People** and add the other family members’ `npub` or hexadecimal **public** keys. This is a recipient directory, not a server allowlist: messages are wrapped only for people listed at the time they are sent.[2]

| Device | Must list in **People** |
| --- | --- |
| Jim | Jean and every other family member |
| Jean | Jim and every other family member |
| Any later device | Every existing family member |

## 6. Verify two-way messaging

Use only new test messages after the recipient lists are correct.

1. Jim sends `Jim → Jean test`.
2. Jean confirms it appears, then sends `Jean → Jim test`.
3. Jim confirms it appears.

If a device says **Relay needs attention**, open **Privacy & relay**, confirm `wss://relay.chat.nostr.africa`, and choose **Save and reconnect**. If joining fails, verify the invite code exactly matches `FAMILY_INVITE_CODE` in `.env`, then inspect relay logs:

```bash
cd ~/family-chat
docker compose -f docker-compose.npm.yml logs --tail=120 relay
```

## 7. Update an existing `~/hearthline` installation

This update installs Family Chat’s messenger redesign, protected-subscription recovery, and automatic invite-code enrollment. It preserves already-enrolled legacy public keys when `FAMILY_PUBKEYS` is left in `.env`.

```bash
cd ~/hearthline
git restore deploy/relay/family-allowlist.py
git pull --ff-only

INVITE_CODE=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
printf 'New family invite code: %s\n' "$INVITE_CODE"
printf '\nFAMILY_INVITE_CODE=%s\n' "$INVITE_CODE" >> .env

docker compose -f docker-compose.npm.yml up -d --build --force-recreate
docker compose -f docker-compose.npm.yml ps
```

Use the new printed invite code for devices that have not joined before. Existing browser identities remain valid because the relay migrates old `FAMILY_PUBKEYS` entries into its persistent membership data after they use the relay.

## 8. Routine operations, revocation, and backup

| Task | Command |
| --- | --- |
| View service status | `cd ~/hearthline && docker compose -f docker-compose.npm.yml ps` |
| Follow relay logs | `cd ~/hearthline && docker compose -f docker-compose.npm.yml logs -f relay` |
| Rotate the invite code | Edit `.env`, then run `docker compose -f docker-compose.npm.yml up -d --force-recreate relay` |
| Update Family Chat | Run the commands in [Section 7](#7-update-an-existing-hearthline-installation) |

Rotating the invite code blocks new enrollment using the old code. It does not remove already-enrolled devices. To revoke a device, remove its public key from the persistent `family-members.json` file in the relay volume, restart the relay, and rotate the invite code; keep a backup before changing membership data.

Back up the relay database while the relay is stopped:

```bash
cd ~/hearthline
docker compose -f docker-compose.npm.yml stop relay
docker run --rm -v hearthline_relay_data:/data -v "$PWD":/backup alpine \
  tar -czf /backup/family-chat-relay-$(date +%F).tgz -C /data .
docker compose -f docker-compose.npm.yml start relay
```

## References

[1]: https://nips.nostr.com/42 "NIP-42: Authentication of Clients to Relays"
[2]: https://nips.nostr.com/17 "NIP-17: Private Direct Messages"
[3]: https://nginx.org/en/docs/http/websocket.html "NGINX: WebSocket proxying"
[4]: https://nips.nostr.com/11 "NIP-11: Relay Information Document"
[5]: https://nips.nostr.com/43 "NIP-43: Relay Access Metadata and Requests"
