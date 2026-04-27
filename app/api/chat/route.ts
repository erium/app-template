import { NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireUser } from "@/server/getUser";
import { logger } from "../../../server/utils/logger";

const chatLog = logger.child({ module: "chat" });

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export async function POST(request: Request) {
  try {
    await requireUser(request);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      chatLog.warn("OPENAI_API_KEY not set — chat endpoint unavailable");
      return NextResponse.json({ error: "AI chat is not configured. Set OPENAI_API_KEY." }, { status: 503 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const result = streamText({
      model: openai(model),
      messages: parsed.data.messages,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    if (err instanceof Response) return err;
    chatLog.error({ err }, "Chat stream failed");
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
