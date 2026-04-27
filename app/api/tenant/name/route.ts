import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({ name: z.string().min(1) });

export async function PUT(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    await db.updateTenantName(user.tenantId, parsed.data.name);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] updateName error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
