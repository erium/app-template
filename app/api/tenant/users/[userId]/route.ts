import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../../server/db";
import { logger } from "../../../../../server/utils/logger";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await requireAdmin(request);
    const { userId: userIdStr } = await params;
    const userIdParsed = z.number().safeParse(Number(userIdStr));
    if (!userIdParsed.success) {
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 400 });
    }

    const userId = userIdParsed.data;
    if (userId === user.id) {
      return NextResponse.json({ error: "Man kann sich nicht selbst löschen." }, { status: 400 });
    }

    await db.deleteUserByIdForTenant(userId, user.tenantId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] deleteUser error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
