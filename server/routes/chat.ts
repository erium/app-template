import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();
const chatLog = logger.child({ module: "chat" });

router.use(requireAuth);

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

router.post("/", async (req: Request, res: Response) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    chatLog.warn("OPENAI_API_KEY not set — chat endpoint unavailable");
    res.status(503).json({ error: "AI chat is not configured. Set OPENAI_API_KEY." });
    return;
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const result = streamText({
      model: openai(model),
      messages: parsed.data.messages,
    });

    result.pipeDataStreamToResponse(res);
  } catch (err) {
    chatLog.error({ err }, "Chat stream failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Chat request failed" });
    }
  }
});

export default router;
