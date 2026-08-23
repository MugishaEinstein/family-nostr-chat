# Deployment Checklist

## Before starting

| Item | Confirm |
| --- | --- |
| DNS | `APP_DOMAIN` and `RELAY_DOMAIN` resolve to the Ubuntu server’s public IP. |
| Firewall | Only ports 22 (as appropriate), 80, and 443 are open. Port 7777 is not exposed. |
| Docker | `docker --version` and `docker compose version` both work. |
| Allowlist | `.env` has the first administrator’s 64-character hexadecimal pubkey in `FAMILY_PUBKEYS`. |
| Backups | A backup location is available for the `relay_data` volume. |

## First validation

Start with `docker compose up -d --build`, then inspect `docker compose ps`. Open the chat host over HTTPS, create an identity, and set its relay value to `wss://RELAY_DOMAIN`. The status pill should read **Relay live**. Add a second allowlisted test key in another browser profile to exchange a message.

## Enrollment rule

Every person must be added in two places: their public key is added to `FAMILY_PUBKEYS` on the server, and the same public key is added in every relevant browser’s **Set the table** directory. Restart the relay after modifying `.env`.

> NIP-17 allows multi-person rooms, but each message is separately encrypted for every receiver; it is well suited to a small family rather than a large group.[1]

## References

[1]: https://nips.nostr.com/17 "NIP-17: Private Direct Messages"

