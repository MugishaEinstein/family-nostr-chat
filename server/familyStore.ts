import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { familyAuditLog, familyInvites, familyMembers, familySpaces } from "../drizzle/schema";
import { getDb } from "./db";
import { hashInviteCode, makeInviteCode } from "./nostrAuth";

type MemberRole = "owner" | "member";

function fail(code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "TOO_MANY_REQUESTS", message: string): never {
  throw new TRPCError({ code, message });
}

function cleanName(value: string, label: string, max = 120) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > max) fail("BAD_REQUEST", `${label} must be between 2 and ${max} characters.`);
  return normalized;
}

function makeSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 52) || "family";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Family Chat data is temporarily unavailable." });
  return db;
}

async function audit(familyId: string, actorPubkey: string, action: string, targetPubkey?: string, details?: Record<string, unknown>) {
  const db = await dbOrThrow();
  await db.insert(familyAuditLog).values({
    id: randomUUID(),
    familyId,
    actorPubkey,
    action,
    targetPubkey,
    details: details ? JSON.stringify(details) : null,
  });
}

/** Writes a minimal read-only relay policy cache only when deployed with a shared state volume. */
export async function syncRelayRegistry() {
  const destination = process.env.FAMILY_REGISTRY_PATH;
  if (!destination) return;
  const db = await dbOrThrow();
  const [spaces, members] = await Promise.all([
    db.select().from(familySpaces),
    db.select().from(familyMembers).where(isNull(familyMembers.removedAt)),
  ]);
  const registry = {
    version: 1,
    spaces: Object.fromEntries(
      spaces.map((space) => [
        space.id,
        {
          relayUrl: space.relayUrl,
          members: members.filter((member) => member.familyId === space.id).map((member) => member.pubkey),
        },
      ]),
    ),
  };
  await fs.mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(registry), "utf8");
  await fs.rename(temporary, destination);
}

export async function createFamilySpace(actorPubkey: string, input: { name: string; displayName: string; relayUrl: string }) {
  const db = await dbOrThrow();
  const name = cleanName(input.name, "Family name");
  const displayName = cleanName(input.displayName, "Your name");
  if (!/^wss:\/\//i.test(input.relayUrl)) fail("BAD_REQUEST", "Use a secure relay URL beginning with wss://.");
  const id = randomUUID();
  const inviteCode = makeInviteCode();
  const relayUrl = input.relayUrl.trim().replace(/\/$/, "");

  await db.transaction(async (tx) => {
    await tx.insert(familySpaces).values({ id, slug: makeSlug(name), name, relayUrl, ownerPubkey: actorPubkey });
    await tx.insert(familyMembers).values({ familyId: id, pubkey: actorPubkey, displayName, role: "owner" });
    await tx.insert(familyInvites).values({
      id: randomUUID(),
      familyId: id,
      codeHash: hashInviteCode(inviteCode),
      label: "First family invite",
      createdByPubkey: actorPubkey,
      maxUses: 20,
    });
  });
  await audit(id, actorPubkey, "family.created");
  await syncRelayRegistry();
  return { id, name, relayUrl, inviteCode, role: "owner" as const };
}

export async function redeemFamilyInvite(actorPubkey: string, input: { code: string; displayName: string }) {
  const db = await dbOrThrow();
  const displayName = cleanName(input.displayName, "Your name");
  const codeHash = hashInviteCode(input.code);
  const invite = await db.select().from(familyInvites).where(eq(familyInvites.codeHash, codeHash)).limit(1);
  const record = invite[0];
  if (!record || record.revoked || (record.expiresAt && record.expiresAt.getTime() < Date.now()) || record.uses >= record.maxUses) {
    fail("BAD_REQUEST", "That family invite is not available. Ask the family owner for a new one.");
  }
  const family = await db.select().from(familySpaces).where(eq(familySpaces.id, record.familyId)).limit(1);
  if (!family[0]) fail("NOT_FOUND", "That family space no longer exists.");
  const existing = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, record.familyId), eq(familyMembers.pubkey, actorPubkey)))
    .limit(1);

  await db.transaction(async (tx) => {
    if (existing[0]) {
      await tx.update(familyMembers).set({ displayName, removedAt: null }).where(eq(familyMembers.id, existing[0].id));
    } else {
      await tx.insert(familyMembers).values({ familyId: record.familyId, pubkey: actorPubkey, displayName, role: "member" });
      await tx.update(familyInvites).set({ uses: record.uses + 1 }).where(eq(familyInvites.id, record.id));
    }
  });
  await audit(record.familyId, actorPubkey, "member.joined");
  await syncRelayRegistry();
  return { id: family[0].id, name: family[0].name, relayUrl: family[0].relayUrl, role: existing[0]?.role ?? "member" };
}

export async function getFamilyForMember(actorPubkey: string, familyId: string) {
  const db = await dbOrThrow();
  const [family] = await db.select().from(familySpaces).where(eq(familySpaces.id, familyId)).limit(1);
  if (!family) fail("NOT_FOUND", "Family space not found.");
  const [membership] = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.pubkey, actorPubkey), isNull(familyMembers.removedAt)))
    .limit(1);
  if (!membership) fail("FORBIDDEN", "This device is not a member of that family space.");
  return { family, membership };
}

export async function listFamilyMembers(actorPubkey: string, familyId: string) {
  await getFamilyForMember(actorPubkey, familyId);
  const db = await dbOrThrow();
  return db.select().from(familyMembers).where(and(eq(familyMembers.familyId, familyId), isNull(familyMembers.removedAt)));
}

export async function makeFamilyInvite(actorPubkey: string, input: { familyId: string; label: string; maxUses: number; expiresInDays: number }) {
  const { membership } = await getFamilyForMember(actorPubkey, input.familyId);
  if (membership.role !== "owner") fail("FORBIDDEN", "Only a family owner can create invitations.");
  const db = await dbOrThrow();
  const code = makeInviteCode();
  const maxUses = Math.min(Math.max(Math.floor(input.maxUses), 1), 50);
  const expiresInDays = Math.min(Math.max(Math.floor(input.expiresInDays), 1), 90);
  await db.insert(familyInvites).values({
    id: randomUUID(),
    familyId: input.familyId,
    codeHash: hashInviteCode(code),
    label: cleanName(input.label, "Invite label"),
    createdByPubkey: actorPubkey,
    maxUses,
    expiresAt: new Date(Date.now() + expiresInDays * 86400000),
  });
  await audit(input.familyId, actorPubkey, "invite.created", undefined, { maxUses, expiresInDays });
  return { code, maxUses, expiresInDays };
}

export async function removeFamilyMember(actorPubkey: string, familyId: string, targetPubkey: string) {
  const { membership } = await getFamilyForMember(actorPubkey, familyId);
  if (membership.role !== "owner") fail("FORBIDDEN", "Only a family owner can remove members.");
  if (targetPubkey === actorPubkey) fail("BAD_REQUEST", "The family owner cannot remove this device.");
  const db = await dbOrThrow();
  const target = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.pubkey, targetPubkey), isNull(familyMembers.removedAt)))
    .limit(1);
  if (!target[0]) fail("NOT_FOUND", "That member is not active in this family.");
  await db.update(familyMembers).set({ removedAt: new Date() }).where(eq(familyMembers.id, target[0].id));
  await audit(familyId, actorPubkey, "member.removed", targetPubkey);
  await syncRelayRegistry();
  return { success: true };
}
