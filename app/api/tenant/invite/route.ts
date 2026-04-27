import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../server/db";
import { sendInvitationEmail } from "../../../../server/email";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor", "admin"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const existingUser = await db.getUserByEmail(input.email);
    if (existingUser) {
      return NextResponse.json({ error: "Nutzer ist bereits registriert." }, { status: 409 });
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.createInvitation({
      tenantId: user.tenantId,
      email: input.email,
      role: input.role,
      token,
      expiresAt,
      status: "pending",
      createdAt: new Date(),
    });

    logger.info({ token }, "[Tenant] Invite link generated");
    await sendInvitationEmail(input.email, token);

    return NextResponse.json({ success: true, token });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] inviteUser error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
