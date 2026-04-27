import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../../server/db";
import { logger } from "../../../../../server/utils/logger";

export async function DELETE(
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

    await db.deleteInvitationForTenant(idParsed.data, user.tenantId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] revokeInvitation error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
