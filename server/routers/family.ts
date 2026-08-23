import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requireNostrDevice } from "../nostrAuth";
import {
  createFamilySpace,
  getFamilyForMember,
  listFamilyMembers,
  makeFamilyInvite,
  redeemFamilyInvite,
  removeFamilyMember,
} from "../familyStore";
import { enforceRateLimit } from "../rateLimit";

const familyId = z.string().uuid();

export const familyRouter = router({
  create: publicProcedure
    .input(z.object({ name: z.string().min(2).max(120), displayName: z.string().min(2).max(120), relayUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const pubkey = await requireNostrDevice(ctx);
      enforceRateLimit("family-create", pubkey, ctx.req.ip, 3, 60 * 60 * 1000);
      return createFamilySpace(pubkey, input);
    }),
  join: publicProcedure
    .input(z.object({ code: z.string().min(6).max(120), displayName: z.string().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const pubkey = await requireNostrDevice(ctx);
      enforceRateLimit("family-join", pubkey, ctx.req.ip, 12, 60 * 60 * 1000);
      return redeemFamilyInvite(pubkey, input);
    }),
  access: publicProcedure
    .input(z.object({ familyId }))
    .query(async ({ ctx, input }) => {
      const { family, membership } = await getFamilyForMember(await requireNostrDevice(ctx), input.familyId);
      return { family, membership };
    }),
  members: publicProcedure
    .input(z.object({ familyId }))
    .query(async ({ ctx, input }) => listFamilyMembers(await requireNostrDevice(ctx), input.familyId)),
  createInvite: publicProcedure
    .input(z.object({ familyId, label: z.string().min(2).max(120), maxUses: z.number().int().min(1).max(50), expiresInDays: z.number().int().min(1).max(90) }))
    .mutation(async ({ ctx, input }) => makeFamilyInvite(await requireNostrDevice(ctx), input)),
  removeMember: publicProcedure
    .input(z.object({ familyId, pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/) }))
    .mutation(async ({ ctx, input }) => removeFamilyMember(await requireNostrDevice(ctx), input.familyId, input.pubkey.toLowerCase())),
});
