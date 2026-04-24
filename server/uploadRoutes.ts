import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

// LOGGING UTILITY
const LOG_FILE = path.join(process.cwd(), "upload_debug.log");
function log(msg: string) {
  const time = new Date().toISOString();
  const entry = `[${time}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.log(entry.trim());
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    log("Multer: Determining destination...");
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${nanoid(12)}${ext}`;
    log(`Multer: Generating filename: ${name} (original: ${file.originalname})`);
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  // REMOVED FILE FILTER FOR DEBUGGING
});

export function registerUploadRoutes(app: express.Express) {
  // Serve uploaded files
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Upload endpoint with Error Handling Wrapper
  app.post("/api/upload", (req, res, next) => {
    const contentLength = req.headers["content-length"];
    log(`Request received at /api/upload (Content-Length: ${contentLength || "unknown"})`);
    
    // Set a longer timeout for this specific request
    req.setTimeout(30 * 60 * 1000); // 30 minutes
    res.setTimeout(30 * 60 * 1000); // 30 minutes
    
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        log(`Multer Error: ${err.message} (${err.code})`);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ 
            error: "Datei zu groß. Maximum: 1GB",
            code: "FILE_TOO_LARGE"
          });
        }
        return res.status(400).json({ error: `Upload Fehler: ${err.message}` });
      } else if (err) {
        log(`General Error: ${err.message}`);
        return res.status(400).json({ error: err.message });
      }
      log("Multer finished successfully.");
      next();
    });
  }, (req, res) => {
    log("Processing request after Multer...");

    if (!req.file) {
      log("Error: No file in req.file");
      res.status(400).json({ error: "Keine Datei hochgeladen (req.file missing)" });
      return;
    }
    const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);
    const url = `/uploads/${req.file.filename}`;
    log(`Success! File saved as: ${req.file.filename} (${sizeInMB} MB)`);
    res.json({ url, filename: req.file.filename, originalName: req.file.originalname });
  });
  
  // Handle connection errors
  app.use("/api/upload", (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log(`Upload Error Handler: ${err.message || err}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Upload fehlgeschlagen. Bitte versuche es erneut.",
        details: err.message
      });
    }
  });
}
