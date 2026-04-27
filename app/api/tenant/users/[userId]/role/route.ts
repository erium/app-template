import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/getUser";
import * as db from "../../../../../../server/db";
import { logger } from "../../../../../../server/utils/logger";

const schema = z.object({
  userId: z.number(),
  role: z.enum(["viewer", "editor", "admin"]),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    const { userId: userIdStr } = await params;
    const body = await request.json();
    const parsed = schema.safeParse({ userId: Number(userIdStr), role: body.role });
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await db.updateUserRole(parsed.data.userId, admin.tenantId, parsed.data.role);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Tenant] updateUserRole error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
