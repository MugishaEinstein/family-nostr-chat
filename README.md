# Family Chat — Private Nostr Messenger

Family Chat is an installable, browser-based family conversation room that publishes **NIP-17 private direct messages** through a Nostr relay you operate. Each browser keeps its own Nostr secret locally, authenticates to the relay with NIP-42, and sends recipient-specific NIP-44/NIP-59 gift wraps. This makes a small household group practical while keeping message contents out of the relay’s readable event content.[1] [2] [3]

> **Threat-model note.** This package is designed for a small, trusted family group—not for high-risk communications. NIP-44 documents important limitations, including no forward secrecy if a long-term key is compromised and potential network metadata exposure.[2] Protect each device, use HTTPS/WSS, and keep regular server backups.

## What is included

| Component | Purpose |
| --- | --- |
| `client/` | React web app that creates/imports a device key, joins one family room, locally decrypts messages, and manages a local family directory. |
| `relay/` service | `strfry` Nostr relay with NIP-42 enabled. It keeps data in an LMDB volume and accepts only authenticated, allowlisted `kind:1059` gift-wrap events.[4] |
| `proxy/` service | Caddy reverse proxy that obtains and renews TLS certificates for the chat and relay hostnames. |
| `deploy/relay/family-allowlist.py` | Relay write policy that permits wrapped messages only after the connection authenticates using a public key listed in `FAMILY_PUBKEYS`.[5] |

## Ubuntu deployment

If your Ubuntu server already uses Nginx Proxy Manager, follow **[NPM_DEPLOYMENT.md](./NPM_DEPLOYMENT.md)** and use `docker-compose.npm.yml` instead of the Caddy-based `docker-compose.yml`. The NPM deployment keeps both the web app and relay behind NPM’s HTTPS/WSS proxy and gives a complete account-enrollment sequence for a family organizer.

Your server needs a domain (or two subdomains) that point to its public IP address. Use one host name for the web app, such as `chat.example.com`, and another for the relay, such as `relay.example.com`. Caddy obtains certificates only after DNS is correct and the server can receive traffic on ports 80 and 443.[6]

| Requirement | Minimum |
| --- | --- |
| Operating system | Ubuntu 22.04 or newer |
| Memory | 1 GB RAM is comfortable for a small personal relay.[6] |
| Network | TCP ports 80 and 443 open; **do not** expose relay port 7777 publicly. |
| Software | Docker Engine plus the Docker Compose plugin |

Install Docker by following Docker’s official Ubuntu instructions, then copy the bundle to the server. From the directory that contains this file, run the following commands:

```bash
cp env.template .env
nano .env
docker compose up -d --build
docker compose logs -f proxy relay
```

Set `APP_DOMAIN` and `RELAY_DOMAIN` in `.env` to the two DNS names. Before starting, replace `FAMILY_PUBKEYS` with the first family member’s **64-character hexadecimal public key**. The app displays an `npub`; its owner can share the equivalent hex pubkey during enrollment. Keep at least one administrator key in the allowlist.

After startup, browse to `https://APP_DOMAIN`, create a device identity, and copy its `npub` in **Relay & identity**. Add each person’s hex pubkey to `FAMILY_PUBKEYS`, then apply the change with:

```bash
docker compose up -d --force-recreate relay
```

Each family member opens `https://APP_DOMAIN`, creates a local device key, enters `wss://RELAY_DOMAIN`, and adds the same household public keys in the app’s **Set the table** panel. Their own pubkey must be present in the server allowlist before the relay will accept their writing session.

## Operations and backup

The persistent relay database is the `relay_data` Docker volume. Back it up routinely while the relay is stopped for a consistent filesystem copy. This example creates a compressed archive in the current directory:

```bash
docker compose stop relay
docker run --rm -v family-nostr-chat_relay_data:/data -v "$PWD":/backup alpine \
  tar -czf /backup/family-chat-relay-$(date +%F).tgz -C /data .
docker compose start relay
```

To update the application and relay image later, replace the bundle with the new version, review `.env`, then run:

```bash
docker compose pull relay proxy
docker compose up -d --build
```

## Security decisions

| Decision | Why it matters |
| --- | --- |
| TLS at Caddy | Browsers require `wss://` from the secure chat site; relay traffic is not left as plaintext WebSocket traffic. |
| NIP-42 authentication | The relay sees an authenticated connection key before accepting a message. NIP-42 standardizes the signed challenge response.[3] |
| NIP-17/NIP-59 gift wraps | A group message is separately wrapped for every recipient and the sender, hiding its message data from a relay operator while enabling key-based recovery.[1] |
| Write allowlist | A small Python policy only accepts `kind:1059` wraps from sessions authenticated with keys in `FAMILY_PUBKEYS`. strfry exposes the authenticated pubkey to write-policy plugins for this use case.[5] |
| Local browser key | No private key is sent to this deployment. However, browser storage is device-local: protect the device and use a separate browser profile for sensitive use. |

## Product boundaries

This initial package deliberately supports one encrypted family room and text messages. It does not yet provide automatic member enrollment, server-side account recovery, moderated rooms, or attachment storage. Adding a person is intentionally a two-step household action: add their public key to the server allowlist and add it to every participant’s local room directory.

## References

[1]: https://nips.nostr.com/17 "NIP-17: Private Direct Messages"
[2]: https://nips.nostr.com/44 "NIP-44: Encrypted Payloads (Versioned)"
[3]: https://nips.nostr.com/42 "NIP-42: Authentication of Clients to Relays"
[4]: https://github.com/hoytech/strfry "strfry official repository"
[5]: https://github.com/hoytech/strfry/blob/master/docs/plugins.md "strfry event-sifter plugins"
[6]: https://usenostr.org/relay.html "Hosting a Nostr relay with strfry, Docker, and Caddy"
