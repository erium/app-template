import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../../../server/db";
import { sendInvitationEmail } from "../../../../../../server/email";
import { logger } from "../../../../../../server/utils/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin(request);
    const { id } = await params;
    const idParsed = z.number().safeParse(Number(id));
    if (!idParsed.success) {
      return NextResponse.json({ error: "Ungültige Einladungs-ID" }, { status: 400 });
    }

    const invite = await db.getInvitationByIdForTenant(idParsed.data, user.tenantId);
    if (!invite) {
      return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.updateInvitationExpiry(invite.id, expiresAt);

    await sendInvitationEmail(invite.email, invite.token);
    return NextResponse.json({ token: invite.token });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] resendInvitation error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
