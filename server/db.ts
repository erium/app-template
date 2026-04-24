import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../drizzle/schema";
import { logger } from "./utils/logger";
import {
  users, InsertUser,
  tenants, InsertTenant,
  invitations, InsertInvitation,
  transactions, InsertTransaction,
} from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://app:app@localhost:5432/app_db";

const pool = new pg.Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function initializeDatabase() {
  logger.info("Database initialized via migration scripts");
}

// ─── TENANT OPERATIONS ───
export async function getTenantById(id: number) {
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0];
}

export async function createTenant(data: InsertTenant) {
  const result = await db.insert(tenants).values(data).returning();
  return result[0];
}

export async function createTenantWithAdmin(companyName: string, userData: Omit<InsertUser, "tenantId" | "role">) {
  return await db.transaction(async (tx) => {
    const [newTenant] = await tx.insert(tenants).values({
      name: companyName,
      slug: companyName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36),
      credits: 100,
    }).returning();

    const [newUser] = await tx.insert(users).values({
      ...userData,
      tenantId: newTenant.id,
      role: "admin",
    }).returning();

    return { tenant: newTenant, user: newUser };
  });
}

export async function updateTenantName(tenantId: number, name: string) {
  const result = await db.update(tenants)
    .set({ name })
    .where(eq(tenants.id, tenantId))
    .returning();
  return result[0];
}

export async function addTenantCredits(tenantId: number, delta: number) {
  await db.update(tenants)
    .set({ credits: sql`${tenants.credits} + ${delta}` })
    .where(eq(tenants.id, tenantId));
}

// ─── USER OPERATIONS ───
export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createUser(user: InsertUser) {
  const result = await db.insert(users).values(user).returning();
  return result[0];
}

export async function getUsers(tenantId: number) {
  return db.select().from(users).where(eq(users.tenantId, tenantId));
}

export async function updateUserLastSignedIn(userId: number) {
  const result = await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return result[0];
}

export async function updateUserRole(userId: number, tenantId: number, role: "viewer" | "editor" | "admin") {
  const result = await db.update(users)
    .set({ role })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning();
  return result[0];
}

export async function updateUserLanguage(userId: number, language: "de" | "en") {
  await db.update(users)
    .set({ language })
    .where(eq(users.id, userId));
}

export async function deleteUserById(userId: number) {
  await db.delete(users).where(eq(users.id, userId));
}

export async function deleteUserByIdForTenant(userId: number, tenantId: number) {
  await db.delete(users).where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
}

export async function getUserByVerificationToken(token: string) {
  const result = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
  return result[0];
}

export async function verifyUserEmail(userId: number) {
  const result = await db.update(users)
    .set({ emailVerified: new Date(), verificationToken: null })
    .where(eq(users.id, userId))
    .returning();
  return result[0];
}

export async function setPasswordResetToken(userId: number, token: string, expires: Date) {
  await db.update(users)
    .set({ resetToken: token, resetTokenExpires: expires })
    .where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string) {
  const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  return result[0];
}

export async function resetUserPassword(userId: number, passwordHash: string) {
  await db.update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpires: null })
    .where(eq(users.id, userId));
}

// ─── INVITATION OPERATIONS ───
export async function createInvitation(data: InsertInvitation) {
  const result = await db.insert(invitations).values(data).returning();
  return result[0];
}

export async function getInvitationByToken(token: string) {
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result[0];
}

export async function getInvitationByIdForTenant(invitationId: number, tenantId: number) {
  const result = await db.select().from(invitations).where(
    and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenantId))
  ).limit(1);
  return result[0];
}

export async function getPendingInvitations(tenantId: number) {
  return db.select().from(invitations).where(
    and(eq(invitations.tenantId, tenantId), eq(invitations.status, "pending"))
  );
}

export async function updateInvitationExpiry(invitationId: number, expiresAt: Date) {
  await db.update(invitations)
    .set({ expiresAt })
    .where(eq(invitations.id, invitationId));
}

export async function deleteInvitationForTenant(invitationId: number, tenantId: number) {
  await db.delete(invitations).where(
    and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenantId))
  );
}

export async function acceptInvitation(id: number) {
  const result = await db.update(invitations)
    .set({ status: 'accepted' })
    .where(eq(invitations.id, id))
    .returning();
  return result[0];
}

// ─── TRANSACTION OPERATIONS ───
export async function getTransactionsByUser(userId: number) {
  return db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt));
}

export async function getTransactionByStripeSessionId(sessionId: string) {
  const result = await db.select().from(transactions)
    .where(eq(transactions.stripeSessionId, sessionId))
    .limit(1);
  return result[0];
}

export async function createTransaction(data: InsertTransaction) {
  const result = await db.insert(transactions).values(data).returning();
  return result[0];
}

// ─── TENANT DELETION ───
export async function deleteTenantFull(tenantId: number) {
  logger.info({ tenantId }, "[Delete Tenant] Starting full delete");

  await db.transaction(async (tx) => {
    await tx.delete(schema.invitations).where(eq(schema.invitations.tenantId, tenantId));
    await tx.delete(schema.users).where(eq(schema.users.tenantId, tenantId));
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  });

  logger.info({ tenantId }, "[Delete Tenant] Successfully deleted");
}
