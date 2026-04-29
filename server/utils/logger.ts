import { createWriteStream, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { type Transform } from "node:stream";
import { fileURLToPath } from "node:url";
import pino, { type Level, type Logger, type StreamEntry } from "pino";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
export const LOG_DIR = resolve(REPO_ROOT, "logs");

const isDev = process.env.NODE_ENV !== "production";
const level = (process.env.LOG_LEVEL ?? (isDev ? "debug" : "info")) as Level;

mkdirSync(LOG_DIR, { recursive: true });

// One file per day per stream: `<base>.<YYYY-MM-DD>.log.ndjson`. Restarts on the
// same day append to the existing file rather than creating numbered siblings.
function logPath(base: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return resolve(LOG_DIR, `${base}.${today}.log.ndjson`);
}

const streams: StreamEntry[] = [
  { level, stream: createWriteStream(logPath("app"), { flags: "a" }) },
  { level: "error", stream: createWriteStream(logPath("error"), { flags: "a" }) },
];

if (isDev) {
  // pino-pretty is dev-only — load via createRequire so production bundles
  // never try to resolve it.
  const require = createRequire(import.meta.url);
  const pretty = require("pino-pretty") as (opts: object) => Transform;
  const prettyStream = pretty({ colorize: true, translateTime: "SYS:HH:MM:ss.l" });
  prettyStream.pipe(process.stdout);
  streams.push({ level, stream: prettyStream });
}

export const logger: Logger = pino(
  { level, timestamp: pino.stdTimeFunctions.isoTime },
  pino.multistream(streams),
);
