import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { generatePdfFromHtml } from "../pdfExport";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

router.use(requireAuth);

// ─── POST /api/export/pdf ───
// Accepts { html: string } and returns an A4 PDF.
// Example: curl -X POST /api/export/pdf -H 'Content-Type: application/json' -d '{"html":"<h1>Hello</h1>"}'
router.post("/pdf", async (req: Request, res: Response) => {
  const schema = z.object({ html: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const pdf = await generatePdfFromHtml(parsed.data.html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=export.pdf");
    res.send(pdf);
  } catch (err) {
    logger.error({ err }, "[Export] PDF generation error");
    res.status(500).json({ error: "PDF generation failed" });
  }
});

export default router;
