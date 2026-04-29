import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
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
