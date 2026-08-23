import { describe, expect, it } from "vitest";
import { hashInviteCode } from "./nostrAuth";
import { enforceRateLimit } from "./rateLimit";

describe("family tenant primitives", () => {
  it("hashes equivalent invite-code whitespace to the same non-secret value", () => {
    expect(hashInviteCode(" FAMILY-ABCD-1234 ")).toBe(hashInviteCode("FAMILY-ABCD-1234"));
    expect(hashInviteCode("FAMILY-ABCD-1234")).toHaveLength(64);
  });

  it("stops repeated self-service actions within their configured window", () => {
    enforceRateLimit("test", "test-pubkey", "127.0.0.1", 1, 60_000);
    expect(() => enforceRateLimit("test", "test-pubkey", "127.0.0.1", 1, 60_000)).toThrow(/Please wait/);
  });
});
