import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@shared/const";
import { requireUser } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await db.deleteUserById(user.id);
    const response = NextResponse.json({ success: true });
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Auth] deleteAccount error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
