
import { serial, integer, text, timestamp, pgTable } from "drizzle-orm/pg-core";

// ─── TENANTS (MANDANTEN) ───
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  billingEmail: text("billing_email"),
  credits: integer("credits").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── USERS ───
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),

  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),

  role: text("role", { enum: ["viewer", "editor", "admin"] }).default("viewer").notNull(),

  credits: integer("credits").default(0).notNull(),
  language: text("language", { enum: ["de", "en"] }).default("de").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),

  emailVerified: timestamp("email_verified"),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── INVITATIONS ───
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["viewer", "editor", "admin"] }).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status", { enum: ["pending", "accepted", "expired"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ─── TRANSACTIONS ───
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer("amount").notNull(),
  credits: integer("credits").notNull(),
  stripeSessionId: text("stripe_session_id"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
