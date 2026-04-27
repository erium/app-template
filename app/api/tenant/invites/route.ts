import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

export async function GET(request: Request) {
  try {
    const user = await requireAdmin(request);
    const result = await db.getPendingInvitations(user.tenantId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] getPendingInvites error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
