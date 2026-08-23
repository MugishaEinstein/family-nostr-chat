import { describe, expect, it } from "vitest";
import { isAuthRequiredError, uniqueFamilyMessageRecipients } from "./nostr";

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
