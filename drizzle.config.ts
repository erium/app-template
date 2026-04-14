import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "postgresql://app:app@localhost:5432/app_db";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
