# Family Chat — Private Nostr Messenger

For the confirmed Ubuntu and Nginx Proxy Manager deployment at `chat.nostr.africa`, use the step-by-step **[Family Chat Setup Guide](./SETUP_GUIDE.md)**. It includes the exact Docker network, proxy hosts, account-enrollment flow, two-way-message test, update path, and backup commands.

Family Chat is an installable, browser-based family conversation room that publishes **NIP-17 private direct messages** through a Nostr relay you operate. Each browser keeps its own Nostr secret locally, authenticates to the relay with NIP-42, and sends recipient-specific NIP-44/NIP-59 gift wraps. This makes a small household group practical while keeping message contents out of the relay’s readable event content.[1] [2] [3]

> **Threat-model note.** This package is designed for a small, trusted family group—not for high-risk communications. NIP-44 documents important limitations, including no forward secrecy if a long-term key is compromised and potential network metadata exposure.[2] Protect each device, use HTTPS/WSS, and keep regular server backups.

## What is included

| Component | Purpose |
| --- | --- |
| `client/` | React web app that creates/imports a device key, joins one family room, locally decrypts messages, and manages a local family directory. |
| `relay/` service | `strfry` Nostr relay with NIP-42 enabled. It keeps data in an LMDB volume and accepts only authenticated, enrolled `kind:1059` gift-wrap events.[4] |
| `proxy/` service | Caddy reverse proxy that obtains and renews TLS certificates for the chat and relay hostnames. |
| `deploy/relay/family-allowlist.py` | Relay write policy that enrolls a device after a valid invite-code claim, then permits its authenticated gift-wrap messages.[5] |

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

Set `APP_DOMAIN` and `RELAY_DOMAIN` in `.env` to the two DNS names. Set `FAMILY_INVITE_CODE` to a long, private code shared only with family members. The relay stores a hash-based claim during enrollment; individual family hexadecimal public keys no longer need to be copied to the server.

After startup, browse to `https://APP_DOMAIN`, create a device identity, enter `wss://RELAY_DOMAIN`, and enter the family invite code. The browser automatically enrolls its public key after the NIP-42 challenge succeeds; no administrator command is required for each person.

Each family member opens `https://APP_DOMAIN`, creates a local device key, enters `wss://RELAY_DOMAIN`, and enters the same private invite code. Then, in **People**, each family device adds the other participants’ public keys so outgoing encrypted messages are wrapped for everyone in the family room.

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
| Invite-code enrollment | A small Python policy accepts a hashed NIP-43-style join claim after NIP-42 authentication, stores that device public key in the relay volume, and subsequently accepts its `kind:1059` wraps.[3] [5] [7] |
| Local browser key | No private key is sent to this deployment. However, browser storage is device-local: protect the device and use a separate browser profile for sensitive use. |

## Product boundaries

This initial package deliberately supports one encrypted family room and text messages. It does not yet provide server-side account recovery, moderated rooms, or attachment storage. Invite-code enrollment adds a device automatically; adding known family recipients in **People** remains necessary so each new message is wrapped for the right devices.

## References

[1]: https://nips.nostr.com/17 "NIP-17: Private Direct Messages"
[2]: https://nips.nostr.com/44 "NIP-44: Encrypted Payloads (Versioned)"
[3]: https://nips.nostr.com/42 "NIP-42: Authentication of Clients to Relays"
[7]: https://nips.nostr.com/43 "NIP-43: Relay Access Metadata and Requests"
[4]: https://github.com/hoytech/strfry "strfry official repository"
[5]: https://github.com/hoytech/strfry/blob/master/docs/plugins.md "strfry event-sifter plugins"
[6]: https://usenostr.org/relay.html "Hosting a Nostr relay with strfry, Docker, and Caddy"
