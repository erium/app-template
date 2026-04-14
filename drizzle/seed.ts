import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { tenants, users } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://app:app@localhost:5432/app_db";

async function seed() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log("Seeding database...");

  // 1. Create default tenant if it doesn't exist
  const slug = "my-org";
  const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);

  let tenantId: number;
  if (existing) {
    tenantId = existing.id;
    console.log(`✓ Default tenant already exists (ID: ${tenantId})`);
  } else {
    const [tenant] = await db.insert(tenants).values({
      name: "My Organization",
      slug,
      credits: 100,
    }).returning();
    tenantId = tenant.id;
    console.log(`✓ Default tenant created (ID: ${tenantId})`);
  }

  // 2. Create admin user if it doesn't exist
  const adminEmail = "admin@example.com";
  const [existingUser] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (existingUser) {
    console.log("✓ Admin user already exists");
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
    console.log(`✓ Admin user created (${adminEmail} / ${defaultPassword})`);
  }

  await pool.end();
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
