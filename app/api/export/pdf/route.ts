import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/getUser";
import { generatePdfFromHtml } from "../../../../server/pdfExport";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({ html: z.string().min(1) });

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const pdf = await generatePdfFromHtml(parsed.data.html);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=export.pdf",
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "[Export] PDF generation error");
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
