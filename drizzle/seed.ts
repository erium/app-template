import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { tenants, users } from "./schema";
import { logger } from "../server/utils/logger";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://app:app@localhost:5432/app_db";

async function seed() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  logger.info("Seeding database...");

  // 1. Create default tenant if it doesn't exist
  const slug = "my-org";
  const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);

  let tenantId: number;
  if (existing) {
    tenantId = existing.id;
    logger.info({ tenantId }, "✓ Default tenant already exists");
  } else {
    const [tenant] = await db.insert(tenants).values({
      name: "My Organization",
      slug,
      credits: 100,
    }).returning();
    tenantId = tenant.id;
    logger.info({ tenantId }, "✓ Default tenant created");
  }

  // 2. Create admin user if it doesn't exist
  const adminEmail = "admin@example.com";
  const [existingUser] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (existingUser) {
    logger.info("✓ Admin user already exists");
  } else {
    const defaultPassword = "ChangeMe!2026";
    const passwordHash = bcrypt.hashSync(defaultPassword, 12);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: "Administrator",
      role: "admin",
      tenantId,
      language: "en",
      emailVerified: new Date(),
    });
    logger.info({ adminEmail, defaultPassword }, "✓ Admin user created");
  }

  await pool.end();
  logger.info("Seed complete.");
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
