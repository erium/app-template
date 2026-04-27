import { NextResponse } from "next/server";
import { requireUser } from "@/server/getUser";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const history = await db.getTransactionsByUser(user.id);
    return NextResponse.json(history);
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Payment] getTransactions error");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
