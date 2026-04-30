import type { NextConfig } from "next";

// Halerium's nginx mounts each app under `/apps/<runner>/<port>/` and STRIPS
// that prefix before forwarding to this server, so we cannot use `basePath`
// (which makes Next.js reject every request that doesn't start with it).
// Instead we set `assetPrefix` so static assets in rendered HTML carry the
// prefix (and reach the proxy on the next hop), and use the wrappers in
// `src/lib/nav.tsx` to add the same prefix to <Link> hrefs and router pushes.
const PREFIX = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  assetPrefix: PREFIX || undefined,
  serverExternalPackages: [
    "pg",
    "playwright",
    "nodemailer",
    "pino",
    "pino-pretty",
    "bcryptjs",
  ],
};

export default nextConfig;
