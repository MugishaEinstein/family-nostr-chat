# Family Chat Setup Guide

This guide deploys **Family Chat** on your Ubuntu server using the Nginx Proxy Manager (NPM) installation you already operate. It assumes your NPM container is connected to the Docker network `nginx-proxy-manager_default` and that you will use `chat.nostr.africa` for the app and `relay.chat.nostr.africa` for its private Nostr relay.

> Family Chat has no email/password accounts. Each browser creates or imports a Nostr key pair. The browser keeps the private key locally; the server receives only a 64-character hexadecimal **public** key for the family allowlist.[1] [2]

## 1. Confirm DNS and server prerequisites

Create both DNS `A` records at the provider responsible for `nostr.africa`. Each must point to the public IPv4 address of `giant`.

| Name | Record type | Purpose |
| --- | --- | --- |
| `chat.nostr.africa` | `A` | Family Chat web application |
| `relay.chat.nostr.africa` | `A` | Secure WebSocket relay |

NPM must be the only public service listening on ports `80` and `443`. Do not expose relay port `7777` through the host firewall: NPM reaches the relay over Docker’s private network instead.[3]

On `giant`, confirm Docker and the NPM network are available:

```bash
docker --version
docker compose version
docker network ls | grep nginx-proxy-manager_default
docker ps --format 'table {{.Names}}\t{{.Networks}}' | grep nginx-proxy-manager
```

## 2. Download or update Family Chat

For a new installation, clone the public repository:

```bash
cd ~
git clone https://github.com/MugishaEinstein/family-nostr-chat.git family-chat
cd ~/family-chat
```

If you already installed an earlier version in `~/hearthline`, use the update instructions in [Section 8](#8-update-an-existing-installation) instead; do not create a second stack.

Create the local environment file:

```bash
cd ~/family-chat
cp env.template .env
cat > .env <<'EOF'
APP_DOMAIN=chat.nostr.africa
RELAY_DOMAIN=relay.chat.nostr.africa
NPM_NETWORK=nginx-proxy-manager_default

# Temporary value for first startup. Replace this with the administrator's public key in Section 5.
FAMILY_PUBKEYS=0000000000000000000000000000000000000000000000000000000000000001
EOF
```

The Compose file joins the application and relay to `nginx-proxy-manager_default`. NPM can then use the Docker service names `web` and `relay` as upstream hostnames without publishing either service directly to the internet.[3]

## 3. Start the private application and relay

Use the NPM-specific Compose file. Do **not** use the standard `docker-compose.yml`, because it launches Caddy and would conflict with NPM.

```bash
cd ~/family-chat
docker compose -f docker-compose.npm.yml up -d --build
docker compose -f docker-compose.npm.yml ps
docker compose -f docker-compose.npm.yml logs --tail=100 web relay
```

At this stage, both services should show as running. The initial placeholder public key deliberately prevents anyone from publishing until the administrator has created the first browser identity.

## 4. Add proxy hosts in Nginx Proxy Manager

Open the NPM administration interface. Under **Hosts → Proxy Hosts**, create one host for the web app and a second host for the relay. Request a Let’s Encrypt certificate for each, enable **Force SSL** and **HTTP/2 Support**, and enable **Block Common Exploits**.

| NPM setting | Web app host | Relay host |
| --- | --- | --- |
| Domain Names | `chat.nostr.africa` | `relay.chat.nostr.africa` |
| Scheme | `http` | `http` |
| Forward Hostname / IP | `web` | `relay` |
| Forward Port | `80` | `7777` |
| Websockets Support | Optional | **Enabled** |
| SSL certificate | New Let’s Encrypt certificate | New Let’s Encrypt certificate |
| Force SSL | Enabled | Enabled |

For the relay host only, add the following in NPM’s **Advanced** tab. Do not add manual `Upgrade` or `Connection` headers; the **Websockets Support** control handles them.[4]

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Verify that NPM is serving both routes:

```bash
curl -I https://chat.nostr.africa
curl -H 'Accept: application/nostr+json' https://relay.chat.nostr.africa
```

The first command should return an HTTP response from the Family Chat site. The second should return a NIP-11 relay-information document in JSON.[5]

## 5. Create the administrator account and activate the allowlist

In the administrator’s browser, visit `https://chat.nostr.africa`. Enter a display name and the relay address below, then choose **Set a key at this place**.

```text
wss://relay.chat.nostr.africa
```

Open **Privacy & relay** and select **Copy hex key for the allowlist**. This is the administrator’s public key, not a secret. On the server, replace the placeholder allowlist with that exact copied value and restart the relay:

```bash
cd ~/family-chat
nano .env
# Set FAMILY_PUBKEYS=<administrator-64-character-hex-public-key>

docker compose -f docker-compose.npm.yml up -d --force-recreate relay
docker compose -f docker-compose.npm.yml exec relay sh -lc 'printf "%s\n" "$FAMILY_PUBKEYS"'
```

Refresh the browser. The room header should show a green indicator and **Private relay**. The current client retries its protected room subscription after the relay’s NIP-42 authentication challenge, so a short “Authenticating your private relay…” state is normal after the first reconnect.[1]

## 6. Enroll each family member

Each person must create their own browser/device identity. They must never share an `nsec` value or any private key.

| Step | Family member | Administrator |
| --- | --- | --- |
| 1 | Open `https://chat.nostr.africa`; enter their name and `wss://relay.chat.nostr.africa`. | — |
| 2 | Select **Set a key at this place**. | — |
| 3 | Open **Privacy & relay → Copy hex key for the allowlist** and send only that hex key through a trusted channel. | Add the received key to `FAMILY_PUBKEYS`. |
| 4 | Add every household member in **People** using their `npub` or hex public key. | Do the same on every other participating device. |

For example, after Jim and Jean are both enrolled, `.env` contains one uninterrupted comma-separated line:

```dotenv
FAMILY_PUBKEYS=<jim-hex-key>,<jean-hex-key>
```

Apply an allowlist change with:

```bash
cd ~/family-chat
docker compose -f docker-compose.npm.yml up -d --force-recreate relay
```

> Every browser must add **every other family member** in **People**. NIP-17 messages are individually wrapped for each selected recipient when sent; adding someone later cannot recover an older message that was never wrapped for their key.[2]

## 7. Verify two-way messaging

Before adding more people, verify the first two devices.

1. On Jim’s device, confirm Jean appears under **People** and send `Jim → Jean test`.
2. On Jean’s device, confirm Jim appears under **People** and send `Jean → Jim test`.
3. Confirm both fresh messages appear on the other device. If either room shows **Relay needs attention**, open **Privacy & relay**, confirm the exact `wss://relay.chat.nostr.africa` address, then select **Save and reconnect**.

If the relay says `restricted: relay accepts authenticated family gift-wrap messages only`, compare the sending browser’s copied hex public key with the `FAMILY_PUBKEYS` value, edit `.env` if necessary, and recreate the relay. The allowlist does not accept `npub` values: use the copied hexadecimal key.

## 8. Update an existing installation

Use this path if you previously deployed the application under `~/hearthline`. It retrieves the Family Chat redesign and NIP-42 subscription-recovery fix. If you had temporarily relaxed the relay policy to test message delivery, the first command restores the repository’s authenticated family-only policy before updating.

```bash
cd ~/hearthline
git restore deploy/relay/family-allowlist.py
git pull --ff-only
docker compose -f docker-compose.npm.yml up -d --build --force-recreate
docker compose -f docker-compose.npm.yml ps
docker compose -f docker-compose.npm.yml logs --tail=100 relay
```

After this update, refresh Family Chat on each device with a hard refresh. Send new test messages in both directions. Existing browser identities and local People lists are preserved because the app retains its established local storage keys.

## 9. Routine operations and backup

| Task | Command |
| --- | --- |
| Service status | `cd ~/hearthline && docker compose -f docker-compose.npm.yml ps` |
| Relay log follow | `cd ~/hearthline && docker compose -f docker-compose.npm.yml logs -f relay` |
| Apply public-key changes | `cd ~/hearthline && docker compose -f docker-compose.npm.yml up -d --force-recreate relay` |
| Update application | Follow [Section 8](#8-update-an-existing-installation) |

Back up the relay data periodically. Stop the relay for a consistent archive, then restart it:

```bash
cd ~/hearthline
docker compose -f docker-compose.npm.yml stop relay
docker run --rm -v hearthline_relay_data:/data -v "$PWD":/backup alpine \
  tar -czf /backup/family-chat-relay-$(date +%F).tgz -C /data .
docker compose -f docker-compose.npm.yml start relay
```

If you used a different Compose directory, Docker may name the volume differently. Confirm it with `docker volume ls | grep relay_data` before the first backup.

## References

[1]: https://nips.nostr.com/42 "NIP-42: Authentication of Clients to Relays"
[2]: https://nips.nostr.com/17 "NIP-17: Private Direct Messages"
[3]: https://nginxproxymanager.com/advanced-config/ "Nginx Proxy Manager: Best Practice — Use a Docker network"
[4]: https://nginx.org/en/docs/http/websocket.html "NGINX: WebSocket proxying"
[5]: https://nips.nostr.com/11 "NIP-11: Relay Information Document"
