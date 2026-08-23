# Family Nostr Chat — Design Exploration

## Three directions considered

| Theme Name | Very Brief Intro | Probability |
| --- | --- | --- |
| Hearth Ledger | A warm, archival family correspondence space inspired by hand-kept address books and mid-century household journals. It emphasizes calm reassurance rather than social-media urgency. | 0.07 |
| Orchard Signal | A fresh, communal interface built around growing things, gentle daylight, and close family ties. It makes private technology feel familiar and lived-in. | 0.03 |
| Midnight Switchboard | A compact, technically expressive communications console with a dark field and precise signal indicators. It makes Nostr relay status central to the visual story. | 0.09 |

## Chosen direction: Hearth Ledger

### Design Movement

**Contemporary editorial domesticity**: the material warmth of an heirloom family notebook translated into an accessible, modern messenger. The visual character is intentionally private and unhurried—not a generic social feed.

### Core Principles

1. **A room, not a feed.** Conversation is arranged as an ongoing shared household space with a fixed people rail and generous message breathing room.
2. **Trust made visible.** Relay connection, identity ownership, and local-key safety are expressed with clear, quiet status language rather than technical clutter.
3. **Memory-friendly hierarchy.** Dates, names, and message content are scannable at a glance; utilities retreat until needed.
4. **Tactile restraint.** Soft paper surfaces, hairline rules, and one dense accent color create an interface that feels deliberate without nostalgia pastiche.

### Color Philosophy

The application lives on **porcelain paper and baked clay**: a warm off-white field reduces visual fatigue, charcoal gives text a dependable ink-like weight, and a single **family red** signals a new message, active room, and relay health. Dusty blue appears only as a secondary technical status tone, keeping the emotional center warm rather than clinical.

### Layout Paradigm

The main workspace is a **ledger spread** rather than a centered dashboard. A narrow left margin holds the household and people; the conversation occupies the wide writing pane; a slim right annotation rail holds relay and privacy context. On small screens, the side material folds into a compact drawer while the conversation remains primary.

### Signature Elements

1. A **stitched red thread** lines the active conversation and composer, as though binding correspondence together.
2. A **household seal**—a simple circular mark of interlocking home lines—anchors identity in the header and setup flow.
3. **Marginalia cards** use tiny caps labels and thin rules to show relay, key, and delivery information without turning the room into a control panel.

### Interaction Philosophy

Interactions should feel quiet and intentional: send actions give a brief grounded confirmation, tabs slide a small thread indicator, and disclosure panels reveal only when requested. The app should never mimic addictive engagement patterns; it prioritizes certainty, legibility, and conversational continuity.

### Animation

Use a custom ease-out curve and transitions below 240ms. Newly sent messages rise in with a 120ms opacity/translate transition; room changes move the thread marker 180ms without moving the whole layout. Status changes fade their dot and copy, while reduced-motion users receive immediate changes. Avoid looping decorative motion.

### Typography System

**Fraunces** supplies the warm editorial display voice for room titles and setup headings. **DM Sans** handles message text, controls, and operational information for compact, high-legibility reading. Use small uppercase letter-spaced labels for metadata; never use an all-caps style for message content.

### Brand Essence

**A private family correspondence room that uses your own Nostr relay, for households that value ownership without complexity.**

Personality: **warm, dependable, discreet**.

### Brand Voice

Headlines should sound like a household invitation; control copy should be precise, calm, and non-technical where possible. Avoid urgency, growth language, and generic onboarding phrases.

Example headline: “A room for the people you keep close.”

Example microcopy: “Your key stays on this device. The relay only carries signed messages.”

### Wordmark & Logo

The mark is a **sealed doorway**: three simple, unevenly nested arch strokes form a protected doorway/house silhouette inside a round seal. It contains no lettering and remains recognizable at small sizes. The wordmark pairs a restrained Fraunces “Hearthline” with a light sans-serif descriptor.

### Signature Brand Color

**Hearth Red — #A83D32**. This baked, grounded red is reserved for the seal, active thread, and primary actions.

## Style Decisions

- Setup screens carry the same ledger language as the conversation room: hairline rules, marginalia labels, and a visible Hearth Red stitched binding connect identity, relay, and key actions.
- The wordmark pairs a Fraunces “Hearthline” with a light, letter-spaced sans-serif descriptor; the circular sealed-door mark is never shown as an anonymous icon.
- Trust copy is designed as quiet marginalia rather than as footer fine print. “Your key stays here” and the family relay status receive equal visual care to the primary call to action.
