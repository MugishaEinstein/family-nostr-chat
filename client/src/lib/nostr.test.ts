import type { Event, Relay } from "nostr-tools";
import { describe, expect, it } from "vitest";
import {
  generateIdentity,
  isAuthRequiredError,
  publishFamilyMessage,
  uniqueFamilyMessageRecipients,
  unwrapFamilyMessage,
} from "./nostr";

describe("uniqueFamilyMessageRecipients", () => {
  it("keeps the sender's device in the encrypted recipient list", () => {
    const sender = "sender-device";
    const recipient = "recipient-device";

    expect(uniqueFamilyMessageRecipients([sender, recipient, sender])).toEqual([sender, recipient]);
  });
});

describe("isAuthRequiredError", () => {
  it("recognizes the relay response that needs NIP-42 authentication and a retry", () => {
    expect(isAuthRequiredError(new Error("auth-required: authenticate this device before publishing family messages"))).toBe(true);
    expect(isAuthRequiredError(new Error("restricted: this device is not authorized"))).toBe(false);
  });
});

describe("publishFamilyMessage", () => {
  it("signs outer family wrappers with the enrolled sender key and keeps them decryptable", async () => {
    const sender = generateIdentity();
    const recipient = generateIdentity();
    const published: Event[] = [];
    const relay = {
      publish: async (event: Event) => {
        published.push(event);
      },
    } as unknown as Relay;

    await publishFamilyMessage(relay, sender, [sender.pubkey, recipient.pubkey], "A private hello", "family-space-id");

    expect(published).toHaveLength(2);
    expect(published.every((event) => event.pubkey === sender.pubkey)).toBe(true);
    expect(published.every((event) => event.tags.some((tag) => tag[0] === "h" && tag[1] === "family-space-id"))).toBe(true);
    expect(unwrapFamilyMessage(published.find((event) => event.tags.some((tag) => tag[0] === "p" && tag[1] === sender.pubkey))!, sender)?.content).toBe("A private hello");
    expect(unwrapFamilyMessage(published.find((event) => event.tags.some((tag) => tag[0] === "p" && tag[1] === recipient.pubkey))!, recipient)?.content).toBe("A private hello");
  });
});
