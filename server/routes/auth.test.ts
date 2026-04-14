import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import authRouter from "./auth";
import { authenticateUser } from "../middleware/auth";
import * as db from "../db";

// Integration test: hits the real PostgreSQL database.
// Run `bash setup-postgres.sh && pnpm db:push` before `pnpm test`.

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticateUser);
  app.use("/api/auth", authRouter);
  return app;
}

describe("auth routes (integration)", () => {
  const email = `test-${randomUUID()}@example.com`;
  const password = "TestPassword123!";
  const companyName = `Test Org ${randomUUID().slice(0, 8)}`;
  const name = "Test User";
  let tenantId: number | undefined;

  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-secret-for-vitest-runs-only";
    }
  });

  afterAll(async () => {
    // Cascade delete: removing the tenant drops users + invitations + transactions.
    if (tenantId !== undefined) {
      await db.deleteTenantFull(tenantId);
    }
  });

  it("registers a new user and tenant", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password, name, companyName });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const created = await db.getUserByEmail(email);
    expect(created).toBeDefined();
    expect(created!.name).toBe(name);
    expect(created!.emailVerified).toBeNull();
    tenantId = created!.tenantId;
  });

  it("rejects login before email verification", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(res.status).toBe(403);
  });

  it("verifies email and then logs in successfully", async () => {
    const user = await db.getUserByEmail(email);
    expect(user?.verificationToken).toBeTruthy();

    const app = buildApp();
    const verifyRes = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: user!.verificationToken });
    expect(verifyRes.status).toBe(200);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe(email);
    expect(loginRes.headers["set-cookie"]).toBeDefined();
  });

  it("rejects login with the wrong password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});
