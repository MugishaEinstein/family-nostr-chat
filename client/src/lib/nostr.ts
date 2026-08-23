import { nip19, nip44, nip59, Relay, utils, finalizeEvent, generateSecretKey, getEventHash, getPublicKey, type Event, type EventTemplate } from "nostr-tools";

export type LocalIdentity = {
  secretHex: string;
  pubkey: string;
};

export type FamilyMember = {
  id: string;
  name: string;
  pubkey: string;
};

export type FamilyContext = {
  id: string;
  name: string;
  relayUrl: string;
  role: "owner" | "member";
};

export type FamilyMessage = {
  id: string;
  content: string;
  createdAt: number;
  author: string;
  tags: string[][];
};

export const FAMILY_SUBJECT = "Family Chat room";
const LEGACY_FAMILY_SUBJECT = "Hearthline family room";
const IDENTITY_KEY = "hearthline.identity.v1";
const MEMBERS_KEY = "hearthline.members.v1";
const SETTINGS_KEY = "hearthline.settings.v1";
const FAMILY_CONTEXT_KEY = "family-chat.space.v1";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return utils.bytesToHex(new Uint8Array(digest));
}

export function normalizeRelayUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!/^wss:\/\//i.test(trimmed) && !/^ws:\/\//i.test(trimmed)) throw new Error("Use a secure relay address beginning with wss://.");
  if (location.protocol === "https:" && /^ws:\/\//i.test(trimmed)) throw new Error("This page is secure, so the relay address must begin with wss://.");
  return trimmed;
}

export function generateIdentity(): LocalIdentity {
  const secret = generateSecretKey();
  return { secretHex: utils.bytesToHex(secret), pubkey: getPublicKey(secret) };
}

export function identityFromSecret(value: string): LocalIdentity {
  const input = value.trim();
  let secret: Uint8Array;
  if (input.startsWith("nsec1")) {
    const decoded = nip19.decode(input);
    if (decoded.type !== "nsec") throw new Error("That is not an nsec key.");
    secret = decoded.data;
  } else if (/^[0-9a-f]{64}$/i.test(input)) {
    secret = utils.hexToBytes(input);
  } else {
    throw new Error("Paste a 64-character hex secret or an nsec key.");
  }
  return { secretHex: utils.bytesToHex(secret), pubkey: getPublicKey(secret) };
}

export function parsePublicKey(value: string) {
  const input = value.trim();
  if (/^[0-9a-f]{64}$/i.test(input)) return input.toLowerCase();
  const decoded = nip19.decode(input);
  if (decoded.type !== "npub") throw new Error("Paste a 64-character public key or an npub.");
  return decoded.data;
}

export function shortKey(key: string, size = 6) {
  return `${key.slice(0, size)}…${key.slice(-4)}`;
}

export function displayNpub(pubkey: string) {
  return nip19.npubEncode(pubkey);
}

export function getStoredIdentity(): LocalIdentity | null {
  try {
    const saved = localStorage.getItem(IDENTITY_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as LocalIdentity;
    return parsed.secretHex && parsed.pubkey ? parsed : null;
  } catch {
    return null;
  }
}

export function storeIdentity(identity: LocalIdentity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function getStoredMembers() {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? "[]") as FamilyMember[];
  } catch {
    return [] as FamilyMember[];
  }
}

export function storeMembers(members: FamilyMember[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function getStoredRelay() {
  return localStorage.getItem(SETTINGS_KEY) ?? "";
}

export function storeRelay(relay: string) {
  localStorage.setItem(SETTINGS_KEY, relay);
}

export function getStoredFamilyContext(): FamilyContext | null {
  try {
    const saved = localStorage.getItem(FAMILY_CONTEXT_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as FamilyContext;
    if (!parsed.id || !parsed.name || !parsed.relayUrl || (parsed.role !== "owner" && parsed.role !== "member")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeFamilyContext(context: FamilyContext) {
  localStorage.setItem(FAMILY_CONTEXT_KEY, JSON.stringify(context));
}

export function clearFamilyContext() {
  localStorage.removeItem(FAMILY_CONTEXT_KEY);
}

export function buildRelay(relayUrl: string, identity: LocalIdentity) {
  const relay = new Relay(relayUrl);
  relay.onauth = async (template) => signRelayAuth(template, identity);
  return relay;
}

/** Signs the pending NIP-42 challenge with this device's Family Space identity. */
export async function signRelayAuth(template: EventTemplate, identity: LocalIdentity) {
  return finalizeEvent(template, utils.hexToBytes(identity.secretHex));
}

/** Signs a NIP-98-style request authorization. The private key never leaves this device. */
export function signNostrHttpAuthorization(url: string, method: string, identity: LocalIdentity) {
  const event = finalizeEvent(
    { kind: 27235, content: "", created_at: nowSeconds(), tags: [["u", url], ["method", method.toUpperCase()]] },
    utils.hexToBytes(identity.secretHex),
  );
  return `Nostr ${btoa(JSON.stringify(event))}`;
}

/** Legacy one-family enrollment remains readable for existing deployments while Family Spaces use the API. */
export async function enrollWithInviteCode(relay: Relay, identity: LocalIdentity, inviteCode: string) {
  const normalizedCode = inviteCode.trim();
  if (!normalizedCode) throw new Error("Enter the family invite code to join this relay.");
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot securely prepare the family invite code.");
  const claim = await sha256Hex(normalizedCode);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const joinRequest = finalizeEvent({ kind: 28934, content: "", created_at: nowSeconds(), tags: [["-"], ["claim", claim]] }, utils.hexToBytes(identity.secretHex));
    try {
      await relay.publish(joinRequest);
      return;
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : "";
      if (!(reason.startsWith("auth-required:") || reason.startsWith("restricted:")) || attempt === 3) break;
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "Unable to join the family relay.";
  if (reason.startsWith("restricted:")) throw new Error("That family invite code is not valid for this relay.");
  throw new Error(reason);
}

/**
 * Builds NIP-59 compatible encrypted wraps with a signed outer family `h` tag.
 * The tag exposes tenant metadata only; content remains inside the rumor and seal.
 */
export function uniqueFamilyMessageRecipients(recipients: string[]) {
  // Include the sender's own device so it receives and can decrypt a durable copy.
  return Array.from(new Set(recipients));
}

export async function publishFamilyMessage(
  relay: Relay,
  identity: LocalIdentity,
  recipients: string[],
  content: string,
  familyId?: string,
) {
  const uniqueRecipients = uniqueFamilyMessageRecipients(recipients);
  if (!uniqueRecipients.length) throw new Error("Add at least one family member before sending a message.");

  if (!familyId) {
    const wraps = nip59.wrapManyEvents(
      { kind: 14, content: content.trim(), created_at: nowSeconds(), tags: [...uniqueRecipients.map((pubkey) => ["p", pubkey]), ["subject", FAMILY_SUBJECT]] },
      utils.hexToBytes(identity.secretHex),
      uniqueRecipients,
    );
    await Promise.all(wraps.map((event) => relay.publish(event)));
    return;
  }

  const senderSecret = utils.hexToBytes(identity.secretHex);
  const rumor = {
    kind: 14,
    content: content.trim(),
    created_at: nowSeconds(),
    tags: [...uniqueRecipients.map((pubkey) => ["p", pubkey]), ["subject", FAMILY_SUBJECT], ["h", familyId]],
    pubkey: identity.pubkey,
  };
  const signedRumor = { ...rumor, id: getEventHash(rumor) };
  const wraps = uniqueRecipients.map((recipient) => {
    const seal = finalizeEvent(
      {
        kind: 13,
        content: nip44.v2.encrypt(JSON.stringify(signedRumor), nip44.v2.utils.getConversationKey(senderSecret, recipient)),
        created_at: nowSeconds() - Math.floor(Math.random() * 172800),
        tags: [],
      },
      senderSecret,
    );
    const wrappingSecret = generateSecretKey();
    return finalizeEvent(
      {
        kind: 1059,
        content: nip44.v2.encrypt(JSON.stringify(seal), nip44.v2.utils.getConversationKey(wrappingSecret, recipient)),
        created_at: nowSeconds() - Math.floor(Math.random() * 172800),
        tags: [["p", recipient], ["h", familyId]],
      },
      wrappingSecret,
    );
  });
  await Promise.all(wraps.map((event) => relay.publish(event)));
}

export function unwrapFamilyMessage(event: Event, identity: LocalIdentity): FamilyMessage | null {
  try {
    const [rumor] = nip59.unwrapManyEvents([event], utils.hexToBytes(identity.secretHex));
    if (!rumor || rumor.kind !== 14) return null;
    const subject = rumor.tags.find((tag) => tag[0] === "subject")?.[1];
    if (subject !== FAMILY_SUBJECT && subject !== LEGACY_FAMILY_SUBJECT) return null;
    return { id: rumor.id, content: rumor.content, createdAt: rumor.created_at, author: rumor.pubkey, tags: rumor.tags };
  } catch {
    return null;
  }
}

export function isFamilyRoomMessage(message: FamilyMessage, allowedMembers: string[], familyId?: string) {
  if (familyId && !message.tags.some((tag) => tag[0] === "h" && tag[1] === familyId)) return false;
  const participants = new Set([message.author, ...message.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1])]);
  return Array.from(participants).every((pubkey) => allowedMembers.includes(pubkey));
}
