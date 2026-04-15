import { Router, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { authService } from "../_core/auth";
import * as db from "../db";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../email";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

// ─── GET /api/auth/me ───
router.get("/me", (req: Request, res: Response) => {
  res.json(req.user ?? null);
});

// ─── POST /api/auth/language ───
router.post("/language", requireAuth, async (req: Request, res: Response) => {
  const schema = z.object({ language: z.enum(["de", "en"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  try {
    await db.updateUserLanguage(req.user!.id, parsed.data.language);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] updateLanguage error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/logout ───
router.post("/logout", (req: Request, res: Response) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});

// ─── POST /api/auth/register ───
router.post("/register", async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(100),
    name: z.string().min(1).max(100),
    companyName: z.string().min(1).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  try {
    const existing = await db.getUserByEmail(input.email);
    if (existing) {
      res.status(409).json({ error: "E-Mail bereits vergeben" });
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const verificationToken = randomUUID();

    const { user } = await db.createTenantWithAdmin(input.companyName, {
      email: input.email,
      passwordHash,
      name: input.name,
      language: "de",
      verificationToken,
      emailVerified: null,
    } as any);

    sendVerificationEmail(input.email, verificationToken, input.name).catch(
      (err) => logger.error({ err }, "Failed to send verification email"),
    );

    res.json({ success: true, message: "Bitte E-Mail bestätigen" });
  } catch (err) {
    logger.error({ err }, "[Auth] register error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/verify-email ───
router.post("/verify-email", async (req: Request, res: Response) => {
  const schema = z.object({ token: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await db.getUserByVerificationToken(parsed.data.token);
    if (!user) {
      res.status(400).json({ error: "Ungültiges Token" });
      return;
    }

    await db.verifyUserEmail(user.id);

    const token = await authService.createSessionToken(
      user.id,
      user.email,
      user.tenantId,
    );
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] verifyEmail error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/login ───
router.post("/login", async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  try {
    const user = await db.getUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Ungültige Anmeldedaten" });
      return;
    }

    if (!user.emailVerified) {
      res
        .status(403)
        .json({ error: "Bitte bestätige deine E-Mail-Adresse." });
      return;
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Ungültige Anmeldedaten" });
      return;
    }

    const token = await authService.createSessionToken(
      user.id,
      user.email,
      user.tenantId,
    );
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.json({ user });
  } catch (err) {
    logger.error({ err }, "[Auth] login error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/join ───
router.post("/join", async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string(),
    password: z.string().min(6),
    name: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  try {
    const invitation = await db.getInvitationByToken(input.token);

    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt < new Date()
    ) {
      res
        .status(400)
        .json({ error: "Einladung ungültig oder abgelaufen" });
      return;
    }

    const existingUser = await db.getUserByEmail(invitation.email);
    if (existingUser) {
      res.status(409).json({ error: "Nutzer existiert bereits" });
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await db.createUser({
      email: invitation.email,
      passwordHash,
      name: input.name,
      role: invitation.role as any,
      tenantId: invitation.tenantId,
      language: "de",
      emailVerified: new Date(),
    });

    await db.acceptInvitation(invitation.id);

    const sessionToken = await authService.createSessionToken(
      user.id,
      user.email,
      user.tenantId,
    );
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] join error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/forgot-password ───
router.post("/forgot-password", async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await db.getUserByEmail(parsed.data.email);
    if (!user) {
      // Silent success to prevent enumeration
      res.json({ success: true });
      return;
    }

    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour validity

    await db.setPasswordResetToken(user.id, token, expires);
    await sendPasswordResetEmail(user.email, token, user.language as any);

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] forgotPassword error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/auth/reset-password ───
router.post("/reset-password", async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string(),
    password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  try {
    const user = await db.getUserByResetToken(input.token);

    if (
      !user ||
      !user.resetTokenExpires ||
      user.resetTokenExpires < new Date()
    ) {
      res
        .status(400)
        .json({ error: "Token ungültig oder abgelaufen" });
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.resetUserPassword(user.id, passwordHash);

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] resetPassword error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── DELETE /api/auth/account ───
router.delete("/account", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.deleteUserById(req.user!.id);

    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] deleteAccount error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

export default router;
