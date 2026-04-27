import { NextResponse } from "next/server";
import { getUser } from "@/server/getUser";

export async function GET(request: Request) {
  const user = await getUser(request);
  return NextResponse.json(user ?? null);
}
