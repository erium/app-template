import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import * as db from "../db";
import { sendInvitationEmail } from "../email";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

// All tenant routes require authentication
router.use(requireAuth);

// ─── GET /api/tenant/settings ───
router.get("/settings", async (req: Request, res: Response) => {
  try {
    const tenant = await db.getTenantById(req.user!.tenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant nicht gefunden" });
      return;
    }
    res.json({ name: tenant.name });
  } catch (err) {
    logger.error({ err }, "[Tenant] getSettings error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── PUT /api/tenant/name ───
router.put("/name", requireAdmin, async (req: Request, res: Response) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  try {
    await db.updateTenantName(req.user!.tenantId, parsed.data.name);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Tenant] updateName error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── GET /api/tenant/users ───
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.getUsers(req.user!.tenantId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Tenant] getUsers error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── POST /api/tenant/invite ───
router.post("/invite", requireAdmin, async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    role: z.enum(["viewer", "editor", "admin"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  try {
    const existingUser = await db.getUserByEmail(input.email);
    if (existingUser) {
      res.status(409).json({ error: "Nutzer ist bereits registriert." });
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.createInvitation({
      tenantId: req.user!.tenantId,
      email: input.email,
      role: input.role,
      token,
      expiresAt,
      status: "pending",
      createdAt: new Date(),
    });

    logger.info({ token }, "[Tenant] Invite link generated");
    await sendInvitationEmail(input.email, token);

    res.json({ success: true, token });
  } catch (err) {
    logger.error({ err }, "[Tenant] inviteUser error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── PUT /api/tenant/users/:userId/role ───
router.put(
  "/users/:userId/role",
  requireAdmin,
  async (req: Request, res: Response) => {
    const schema = z.object({
      userId: z.number(),
      role: z.enum(["viewer", "editor", "admin"]),
    });
    const parsed = schema.safeParse({
      userId: Number(req.params.userId),
      role: req.body.role,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await db.updateUserRole(
        parsed.data.userId,
        req.user!.tenantId,
        parsed.data.role,
      );
      res.json(result);
    } catch (err) {
      logger.error({ err }, "[Tenant] updateUserRole error:");
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  },
);

// ─── GET /api/tenant/invites ───
router.get("/invites", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.getPendingInvitations(req.user!.tenantId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Tenant] getPendingInvites error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// ─── DELETE /api/tenant/invites/:id ───
router.delete(
  "/invites/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    const idParsed = z.number().safeParse(Number(req.params.id));
    if (!idParsed.success) {
      res.status(400).json({ error: "Ungültige Einladungs-ID" });
      return;
    }

    try {
      await db.deleteInvitationForTenant(idParsed.data, req.user!.tenantId);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[Tenant] revokeInvitation error:");
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  },
);

// ─── POST /api/tenant/invites/:id/resend ───
router.post(
  "/invites/:id/resend",
  requireAdmin,
  async (req: Request, res: Response) => {
    const idParsed = z.number().safeParse(Number(req.params.id));
    if (!idParsed.success) {
      res.status(400).json({ error: "Ungültige Einladungs-ID" });
      return;
    }

    try {
      const invite = await db.getInvitationByIdForTenant(idParsed.data, req.user!.tenantId);
      if (!invite) {
        res.status(404).json({ error: "Einladung nicht gefunden" });
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await db.updateInvitationExpiry(invite.id, expiresAt);

      await sendInvitationEmail(invite.email, invite.token);
      res.json({ token: invite.token });
    } catch (err) {
      logger.error({ err }, "[Tenant] resendInvitation error:");
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  },
);

// ─── DELETE /api/tenant/users/:userId ───
router.delete(
  "/users/:userId",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userIdParsed = z.number().safeParse(Number(req.params.userId));
    if (!userIdParsed.success) {
      res.status(400).json({ error: "Ungültige Benutzer-ID" });
      return;
    }

    const userId = userIdParsed.data;

    if (userId === req.user!.id) {
      res
        .status(400)
        .json({ error: "Man kann sich nicht selbst löschen." });
      return;
    }

    try {
      await db.deleteUserByIdForTenant(userId, req.user!.tenantId);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[Tenant] deleteUser error:");
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  },
);

// ─── DELETE /api/tenant ───
router.delete("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    // Fire and forget - run in background to prevent timeout
    db.deleteTenantFull(req.user!.tenantId).catch((err) => {
      logger.error({ err }, "Background tenant deletion failed");
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Tenant] delete error:");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

export default router;
