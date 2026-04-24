import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { logger } from "../utils/logger";

// Resolve base-path for the current request (reverse-proxy sub-path support).
// Priority: X-Forwarded-Prefix header → BASE_PATH env → "".
function resolveBasePath(req: { headers: Record<string, unknown> }): string {
  const header = req.headers["x-forwarded-prefix"];
  const raw = typeof header === "string" ? header : process.env.BASE_PATH ?? "";
  return raw.replace(/\/+$/, "");
}

function injectBaseHref(html: string, basePath: string): string {
  const href = `${basePath}/`;
  return html.replace(
    /<base\s+href="[^"]*"\s*\/?>/i,
    `<base href="${href}" />`,
  );
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const withBase = injectBaseHref(page, resolveBasePath(req));
      res.status(200).set({ "Content-Type": "text/html" }).end(withBase);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    logger.error({ distPath }, "Could not find the build directory — build the client first");
  }

  app.use(express.static(distPath));

  // fall through to index.html (with injected <base href>) if the file doesn't exist
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    fs.readFile(indexPath, "utf-8", (err, html) => {
      if (err) {
        res.sendFile(indexPath);
        return;
      }
      const withBase = injectBaseHref(html, resolveBasePath(req));
      res.status(200).set({ "Content-Type": "text/html" }).end(withBase);
    });
  });
}
