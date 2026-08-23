import { describe, expect, it } from "vitest";
import { uniqueFamilyMessageRecipients } from "./nostr";

describe("uniqueFamilyMessageRecipients", () => {
  it("keeps the sender's device in the encrypted recipient list", () => {
    const sender = "sender-device";
    const recipient = "recipient-device";

    expect(uniqueFamilyMessageRecipients([sender, recipient, sender])).toEqual([sender, recipient]);
  });
});

