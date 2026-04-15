import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pino, { type Logger } from "pino";
import pinoHttp from "pino-http";

// Resolve the repo root (two levels up from this file) so log paths work
// whether the server runs via tsx (source) or the esbuild bundle (dist).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

function readPackageName(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf-8"));
    if (typeof pkg.name === "string" && pkg.name.length > 0) return pkg.name;
  } catch {
    // fall through
  }
  return "app";
}

const APP_SLUG = readPackageName().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
export const LOG_DIR = resolve(REPO_ROOT, `${APP_SLUG}_logs`);

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

const rollOpts = (name: string) => ({
  file: resolve(LOG_DIR, name),
  frequency: "daily",
  size: "10m",
  mkdir: true,
});

const targets: pino.TransportTargetOptions[] = [
  { target: "pino-roll", level, options: rollOpts("app.log") },
  { target: "pino-roll", level: "error", options: rollOpts("error.log") },
];

if (isDev) {
  targets.push({
    target: "pino-pretty",
    level,
    options: { destination: 1, colorize: true, translateTime: "SYS:HH:MM:ss.l" },
  });
}

export const logger: Logger = pino({ level }, pino.transport({ targets }));

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
