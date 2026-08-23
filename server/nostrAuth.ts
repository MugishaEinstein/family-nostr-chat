import { createHash } from "node:crypto";
import { verifyEvent, type Event } from "nostr-tools";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nostrApiNonces } from "../drizzle/schema";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

const MAX_AUTH_AGE_SECONDS = 90;

function unauthorized(message: string): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message });
}

function decodeEvent(header: string | undefined): Event {
  if (!header?.startsWith("Nostr ")) unauthorized("A signed device authorization is required.");
  try {
    const json = Buffer.from(header.slice("Nostr ".length), "base64").toString("utf8");
    return JSON.parse(json) as Event;
  } catch {
    return unauthorized("The device authorization could not be read.");
  }
}

function requestUrl(ctx: TrpcContext) {
  const forwardedProto = ctx.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = ctx.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProto || ctx.req.protocol || "https";
  const host = forwardedHost || ctx.req.header("host");
  if (!host) unauthorized("The request host is missing.");
  return `${protocol}://${host}${ctx.req.originalUrl}`;
}

function eventTag(event: Event, name: string) {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

/**
 * Validates a NIP-98 style HTTP authorization event and records its event ID so
 * a signed request cannot be replayed. The key remains browser-owned.
 */
export async function requireNostrDevice(ctx: TrpcContext) {
  const event = decodeEvent(ctx.req.header("authorization"));
  const now = Math.floor(Date.now() / 1000);
  const expectedUrl = requestUrl(ctx);

  if (event.kind !== 27235 || !verifyEvent(event)) unauthorized("The device authorization signature is invalid.");
  if (Math.abs(now - event.created_at) > MAX_AUTH_AGE_SECONDS) unauthorized("The device authorization has expired. Try again.");
  if (eventTag(event, "u") !== expectedUrl) unauthorized("The device authorization is for a different request.");
  if (eventTag(event, "method")?.toUpperCase() !== ctx.req.method.toUpperCase()) unauthorized("The device authorization method does not match.");

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Family Chat data is temporarily unavailable." });

  const seen = await db.select({ eventId: nostrApiNonces.eventId }).from(nostrApiNonces).where(eq(nostrApiNonces.eventId, event.id)).limit(1);
  if (seen.length) unauthorized("This device authorization was already used. Try again.");

  await db.insert(nostrApiNonces).values({
    eventId: event.id,
    pubkey: event.pubkey,
    expiresAt: new Date((now + MAX_AUTH_AGE_SECONDS) * 1000),
  });

  return event.pubkey.toLowerCase();
}

export function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
  return `FAMILY-${chars.slice(0, 7).join("")}-${chars.slice(7).join("")}`;
}
