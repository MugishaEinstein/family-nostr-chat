import { TRPCError } from "@trpc/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Per-process safety rail for self-service mutations. The signed public key is
 * the primary limiter; an optional source IP adds a second practical boundary.
 */
export function enforceRateLimit(scope: string, pubkey: string, ip: string | undefined, max: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${pubkey}:${ip ?? "unknown"}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before trying that again." });
  }
  current.count += 1;
}
