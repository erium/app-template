// Local file storage helpers (replaces S3/Manus storage)

import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    // Generate a unique filename
    const ext = path.extname(relKey) || ".bin";
    const filename = `${nanoid(12)}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    if (typeof data === "string") {
      fs.writeFileSync(filepath, data, "utf-8");
    } else {
      fs.writeFileSync(filepath, data);
    }

    const url = `/uploads/${filename}`;
    return { key: relKey, url };
  } catch (error) {
    console.error("[Storage] Upload failed:", error);
    throw error;
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  // For local storage, we just return the URL directly
  // In production, you might want to generate presigned URLs
  const url = `/uploads/${relKey}`;
  return { key: relKey, url };
}

export function deleteStorageFile(filename: string): void {
  try {
    const filepath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (error) {
    console.error("[Storage] Delete failed:", error);
  }
}
