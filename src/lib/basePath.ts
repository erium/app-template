// Base-path for reverse-proxy sub-path deployments (e.g. Halerium).
//
// NEXT_PUBLIC_BASE_PATH is set at build time in start.sh when HALERIUM_ID is
// present. Halerium's nginx STRIPS this prefix before forwarding to the server,
// so we don't set it as Next.js `basePath` (which would make the server reject
// every stripped request). Instead:
//   - `next.config.ts` sets `assetPrefix` so static asset URLs in HTML carry it.
//   - `src/lib/nav.tsx` wraps <Link> / useRouter / usePathname to add it to
//     client-visible URLs (so the URL bar still has the prefix and refresh works).
//   - `src/lib/api.ts` uses BASE_PATH below to prefix every fetch() URL.
export const BASE_PATH: string =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function getApiBase(): string {
  return `${BASE_PATH}/api`;
}
