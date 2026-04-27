import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import { requireUser } from "@/server/getUser";
import { logger } from "../../../server/utils/logger";

const uploadLog = logger.child({ module: "upload" });
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: Request) {
  try {
    await requireUser(request);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const ext = path.extname(file.name);
    const filename = `${nanoid(12)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    uploadLog.debug(`File saved: ${filename} (${sizeInMB} MB)`);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename,
      originalName: file.name,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    uploadLog.error({ err }, "Upload error");
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }
}

export const config = {
  api: { bodyParser: false },
};
