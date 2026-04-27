import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({ language: z.enum(["de", "en"]) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    await db.updateUserLanguage(user.id, parsed.data.language);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Auth] updateLanguage error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
