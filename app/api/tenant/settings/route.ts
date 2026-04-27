import { NextResponse } from "next/server";
import { requireUser } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const tenant = await db.getTenantById(user.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ name: tenant.name });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] getSettings error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
