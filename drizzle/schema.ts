import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const familySpaces = mysqlTable(
  "family_spaces",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 72 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    relayUrl: varchar("relayUrl", { length: 320 }).notNull(),
    ownerPubkey: varchar("ownerPubkey", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("family_spaces_slug_unique").on(table.slug), index("family_spaces_owner_idx").on(table.ownerPubkey)],
);

export const familyMembers = mysqlTable(
  "family_members",
  {
    id: int("id").autoincrement().primaryKey(),
    familyId: varchar("familyId", { length: 36 }).notNull(),
    pubkey: varchar("pubkey", { length: 64 }).notNull(),
    displayName: varchar("displayName", { length: 120 }).notNull(),
    role: mysqlEnum("role", ["owner", "member"]).default("member").notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    removedAt: timestamp("removedAt"),
  },
  (table) => [
    uniqueIndex("family_members_family_pubkey_unique").on(table.familyId, table.pubkey),
    index("family_members_pubkey_idx").on(table.pubkey),
    index("family_members_family_idx").on(table.familyId),
  ],
);

export const familyInvites = mysqlTable(
  "family_invites",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    familyId: varchar("familyId", { length: 36 }).notNull(),
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    createdByPubkey: varchar("createdByPubkey", { length: 64 }).notNull(),
    maxUses: int("maxUses").default(10).notNull(),
    uses: int("uses").default(0).notNull(),
    expiresAt: timestamp("expiresAt"),
    revoked: boolean("revoked").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("family_invites_code_hash_unique").on(table.codeHash), index("family_invites_family_idx").on(table.familyId)],
);

export const familyAuditLog = mysqlTable(
  "family_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    familyId: varchar("familyId", { length: 36 }).notNull(),
    actorPubkey: varchar("actorPubkey", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    targetPubkey: varchar("targetPubkey", { length: 64 }),
    details: text("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("family_audit_log_family_idx").on(table.familyId)],
);

export const nostrApiNonces = mysqlTable(
  "nostr_api_nonces",
  {
    eventId: varchar("eventId", { length: 64 }).primaryKey(),
    pubkey: varchar("pubkey", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("nostr_api_nonces_expiry_idx").on(table.expiresAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FamilySpace = typeof familySpaces.$inferSelect;
export type FamilyMemberRecord = typeof familyMembers.$inferSelect;
