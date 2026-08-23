import { nip19, nip59, Relay, utils, finalizeEvent, generateSecretKey, getPublicKey, type Event } from "nostr-tools";

export type LocalIdentity = {
  secretHex: string;
  pubkey: string;
};

export type FamilyMember = {
  id: string;
  name: string;
  pubkey: string;
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

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function normalizeRelayUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!/^wss:\/\//i.test(trimmed) && !/^ws:\/\//i.test(trimmed)) {
    throw new Error("Use a secure relay address beginning with wss://.");
  }
  if (location.protocol === "https:" && /^ws:\/\//i.test(trimmed)) {
    throw new Error("This page is secure, so the relay address must begin with wss://.");
  }
  return trimmed;
}

export function generateIdentity(): LocalIdentity {
  const secret = generateSecretKey();
  return {
    secretHex: utils.bytesToHex(secret),
    pubkey: getPublicKey(secret),
  };
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
    if (!parsed.secretHex || !parsed.pubkey) return null;
    return parsed;
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

export function buildRelay(relayUrl: string, identity: LocalIdentity) {
  const relay = new Relay(relayUrl);
  relay.onauth = async (template) =>
    finalizeEvent(template, utils.hexToBytes(identity.secretHex));
  return relay;
}

export async function publishFamilyMessage(
  relay: Relay,
  identity: LocalIdentity,
  recipients: string[],
  content: string,
) {
  const uniqueRecipients = Array.from(new Set(recipients.filter((pubkey) => pubkey !== identity.pubkey)));
  if (uniqueRecipients.length === 0) {
    throw new Error("Add at least one family member before sending a message.");
  }
  const wraps = nip59.wrapManyEvents(
    {
      kind: 14,
      content: content.trim(),
      created_at: nowSeconds(),
      tags: [
        ...uniqueRecipients.map((pubkey) => ["p", pubkey]),
        ["subject", FAMILY_SUBJECT],
      ],
    },
    utils.hexToBytes(identity.secretHex),
    uniqueRecipients,
  );
  await Promise.all(wraps.map((event) => relay.publish(event)));
}

export function unwrapFamilyMessage(event: Event, identity: LocalIdentity): FamilyMessage | null {
  try {
    const [rumor] = nip59.unwrapManyEvents([event], utils.hexToBytes(identity.secretHex));
    if (!rumor || rumor.kind !== 14) return null;
    const subject = rumor.tags.find((tag) => tag[0] === "subject")?.[1];
    if (subject !== FAMILY_SUBJECT && subject !== LEGACY_FAMILY_SUBJECT) return null;
    return {
      id: rumor.id,
      content: rumor.content,
      createdAt: rumor.created_at,
      author: rumor.pubkey,
      tags: rumor.tags,
    };
  } catch {
    return null;
  }
}

export function isFamilyRoomMessage(message: FamilyMessage, allowedMembers: string[]) {
  const participants = new Set([
    message.author,
    ...message.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]),
  ]);
  return Array.from(participants).every((pubkey) => allowedMembers.includes(pubkey));
}
