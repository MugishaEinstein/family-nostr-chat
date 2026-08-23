# Nginx Proxy Manager deployment: `chat.nostr.africa`

This runbook assumes that Nginx Proxy Manager (NPM) already runs in Docker on the **same Ubuntu server**. The supplied `docker-compose.npm.yml` joins Hearthline to NPM’s Docker network instead of publishing the chat or relay ports to the internet. This follows NPM’s documented same-network pattern: NPM can reach upstream containers by their Compose service name while those services remain unavailable through the host network.[1]

> Use **two** hostnames. The chat application is `chat.nostr.africa`; the WebSocket relay is `relay.chat.nostr.africa`. Keeping them separate avoids mixing the browser application and its persistent relay protocol on one proxy host.

## 1. DNS and firewall

Create two DNS `A` records pointing to your Ubuntu server’s public IPv4 address. Ensure the firewall allows only TCP ports `80` and `443` for web traffic; NPM handles both. Do **not** publish or open relay port `7777`.

| DNS name | Purpose | Target |
| --- | --- | --- |
| `chat.nostr.africa` | Family web application | Ubuntu server public IP |
| `relay.chat.nostr.africa` | Private secure WebSocket relay | Ubuntu server public IP |

## 2. Prepare the repository on Ubuntu

Run these commands on the Ubuntu server. Replace the repository URL only if you copied the project from a different remote.

```bash
sudo apt update
sudo apt install -y git ca-certificates

# Install Docker Engine and the Compose plugin if they are not already installed.
# Follow https://docs.docker.com/engine/install/ubuntu/ for the official repository setup.

git clone https://github.com/MugishaEinstein/family-nostr-chat.git hearthline
cd hearthline

docker network ls
cp env.template .env
nano .env
```

Set the file’s values as follows. The `NPM_NETWORK` value must exactly match the network used by your NPM application. Many Docker Compose NPM installations create a network named `<npm-folder>_default`; do not assume it is literally `npm_default`—use `docker network ls` to confirm.

```dotenv
APP_DOMAIN=chat.nostr.africa
RELAY_DOMAIN=relay.chat.nostr.africa
NPM_NETWORK=<actual-npm-docker-network-name>

# Use a temporary 64-character hexadecimal placeholder for the first launch.
# Replace it with the administrator's copied hex key in the account setup step below.
FAMILY_PUBKEYS=0000000000000000000000000000000000000000000000000000000000000001
```

Attach NPM itself to the same network if it is not already connected. Replace `npm-app` with the actual NPM container name from `docker ps`:

```bash
docker network connect <actual-npm-docker-network-name> npm-app
```

Start Hearthline. This creates only the application and relay services—NPM remains the sole listener on ports 80 and 443.

```bash
docker compose -f docker-compose.npm.yml up -d --build
docker compose -f docker-compose.npm.yml ps
docker compose -f docker-compose.npm.yml logs -f web relay
```

## 3. Add the two NPM proxy hosts

In NPM, open **Hosts → Proxy Hosts → Add Proxy Host**. Add the following records. For the relay host, enable **Websockets Support**. NGINX requires WebSocket upgrade headers to be passed to the upstream, which NPM configures through that switch.[2]

| NPM field | Chat proxy host | Relay proxy host |
| --- | --- | --- |
| Domain Names | `chat.nostr.africa` | `relay.chat.nostr.africa` |
| Scheme | `http` | `http` |
| Forward Hostname / IP | `web` | `relay` |
| Forward Port | `80` | `7777` |
| Websockets Support | Optional | **Enabled** |
| Block Common Exploits | Enabled | Enabled |
| SSL certificate | Request a new Let’s Encrypt certificate | Request a new Let’s Encrypt certificate |
| Force SSL | Enabled | Enabled |
| HTTP/2 Support | Enabled | Enabled |

For the **relay** proxy host, add this in NPM’s **Advanced** tab after enabling Websockets Support. Do not add manual `Upgrade` or `Connection` headers—NPM’s Websockets Support setting owns them.

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Then verify both endpoints:

```bash
curl -I https://chat.nostr.africa
curl -H 'Accept: application/nostr+json' https://relay.chat.nostr.africa
```

The relay request should return NIP-11 relay metadata. NIP-11 is the relay information document served by Nostr relays.[3]

## 4. Create and enroll the administrator account

Hearthline does not use email/password accounts. A person’s **Nostr key pair is their account**. The private part stays in their browser; the hexadecimal public key is copied to the server allowlist.

1. Visit `https://chat.nostr.africa` in the administrator’s preferred browser and enter a name plus `wss://relay.chat.nostr.africa`.
2. Select **Set a key at this place**. The initial relay will not accept messages yet, which is expected.
3. Open **Relay & identity**, then select **Copy hex key for the allowlist**.
4. On the Ubuntu server, replace the placeholder value in `.env` with that copied 64-character key, then restart the relay:

```bash
nano .env
docker compose -f docker-compose.npm.yml up -d --force-recreate relay
```

5. Refresh the browser and open the settings panel again. The status should show that the relay is live.

## 5. Enroll each family member

Each person repeats the local account creation step on their own browser/device. They send their copied **hex public key** to the organizer through a trusted channel. The organizer adds the key to the comma-separated `FAMILY_PUBKEYS` list and recreates the relay.

```dotenv
FAMILY_PUBKEYS=<administrator-hex-key>,<alice-hex-key>,<bob-hex-key>
```

```bash
docker compose -f docker-compose.npm.yml up -d --force-recreate relay
```

Finally, on **every participating browser**, open the **+** control next to **At the table** and add the name plus public key of every household member. This local room directory determines the recipients for new NIP-17 family messages. A person is fully ready only after their key is both in the server allowlist and in everyone’s local room directory.

## Routine operations

| Task | Command |
| --- | --- |
| Check running services | `docker compose -f docker-compose.npm.yml ps` |
| Tail relay logs | `docker compose -f docker-compose.npm.yml logs -f relay` |
| Apply allowlist edits | `docker compose -f docker-compose.npm.yml up -d --force-recreate relay` |
| Update web and relay images | `git pull && docker compose -f docker-compose.npm.yml up -d --build` |

## References

[1]: https://nginxproxymanager.com/advanced-config/ "Nginx Proxy Manager: Best Practice — Use a Docker network"
[2]: https://nginx.org/en/docs/http/websocket.html "NGINX: WebSocket proxying"
[3]: https://nips.nostr.com/11 "NIP-11: Relay Information Document"
