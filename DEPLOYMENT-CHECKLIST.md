# Family Chat deployment checklist

The current checklist is contained in **[MULTI_FAMILY_SETUP.md](./MULTI_FAMILY_SETUP.md)**. Before inviting users, confirm that MariaDB, `web`, and `relay` are healthy; the Nginx Proxy Manager application host forwards to `web:3000`; the relay host forwards to `relay:7777` with WebSockets enabled; and two separate Family Spaces cannot exchange messages.
