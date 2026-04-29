import { createWriteStream, mkdirSync, readdirSync } from "node:fs";
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

// Each process start opens a fresh log file: `<base>.<YYYY-MM-DD>.log` for the
// first start of the day, `<base>.<YYYY-MM-DD>.2.log` for the second, etc.
// Counter is derived from existing files in LOG_DIR so concurrent or restarted
// processes never collide.
function nextLogPath(base: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const re = new RegExp(`^${base}\\.${today}(?:\\.(\\d+))?\\.log\\.ndjson$`);
  let max = 0;
  for (const f of readdirSync(LOG_DIR)) {
    const m = f.match(re);
    if (m) max = Math.max(max, m[1] ? parseInt(m[1], 10) : 1);
  }
  const counter = max + 1;
  const suffix = counter === 1 ? "" : `.${counter}`;
  return resolve(LOG_DIR, `${base}.${today}${suffix}.log.ndjson`);
}

const streams: StreamEntry[] = [
  { level, stream: createWriteStream(nextLogPath("app"), { flags: "a" }) },
  { level: "error", stream: createWriteStream(nextLogPath("error"), { flags: "a" }) },
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
