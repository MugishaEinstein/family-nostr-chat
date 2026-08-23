# Multi-Family Nostr Design Notes

Family Chat’s multi-family model must treat each household as an independent tenant, with server-side membership checks on both message publication and subscription. NIP-29 describes relay-enforced closed groups identified by a group identifier and referenced by an `h` tag. It also defines relay-managed membership and owner/admin roles, though it remains draft. NIP-43 describes relay membership, join requests, and invite claims, also as a draft.

For this product, the current one-relay/one-family `FAMILY_PUBKEYS` policy cannot be reused. The required production model is a database-backed `family_spaces` record, a tenant-scoped membership record, expiring invite records, and a server-authorized mapping between a signed browser key and a Family Space. Events must be labeled with a signed tenant identifier and the relay policy must reject events or subscriptions when the authenticated key lacks membership in that tenant.

The group semantics can borrow NIP-29’s per-group isolation and owner/member roles, while the enrollment flow can borrow NIP-43’s invitation lifecycle. Because both specifications are drafts, Family Chat must enforce the core authorization rules itself rather than claiming broad third-party interoperability.

## Sources

[1]: https://nips.nostr.com/29 "NIP-29: Relay-based Groups"
[2]: https://nips.nostr.com/43 "NIP-43: Relay Access Metadata and Requests"
