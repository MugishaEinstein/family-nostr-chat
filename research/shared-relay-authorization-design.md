# Shared-Relay Family Chat Authorization Design

## Tenant boundary

Each family is a `family_space` identified by an opaque public ID. A browser identity is a 64-character Nostr public key. A device can be a member of one or more family spaces, but all authorization decisions are made against the `(familySpaceId, pubkey)` pair.

## Server authority

The self-hosted Family Chat application uses a local database as the source of truth for family spaces, owners, memberships, invitations, and API request nonces. The server accepts browser requests only with a signed NIP-98 authorization event. It verifies the signature, method, exact URL, body hash, freshness, and single use of the signed request before changing family membership data.

## Relay cache and event policy

The full-stack application writes a compact membership cache to a shared Docker volume. The `strfry` policy reads that cache. Every Family Chat gift-wrap is signed with a visible outer `h` tag containing the family space ID and one `p` recipient tag. The policy accepts it only if the NIP-42 authenticated publisher and the recipient are members of the same `h` family space. Relay read protection continues to require an involved authenticated public key.

The outer family ID is metadata, not message content. Message content remains inside NIP-59 encrypted rumor/seal layers. A malicious enrolled member can send messages only to its own family’s members; it cannot route an event to another family member because the policy rejects a mismatched `h`/`p` membership combination.

## Self-service lifecycle

A new browser generates its local identity, signs a `create family` request, and becomes that family’s owner. An owner creates time-limited or use-limited invitations. An invitee signs a join request using the code; the server validates the code and writes their membership. The app then fetches members through signed requests and publishes/subscribes only with that family ID.

## Abuse controls

Family creation and invitation redemption are rate limited by signed public key and IP at the application API. Invite records have expiration, usage caps, and revocation state. Every mutation is written to an audit record. The shared relay is still deliberately public at the connection layer; its policy rejects Family Chat event writes that lack valid tenant membership.
