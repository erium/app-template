// Base-path for reverse-proxy sub-path deployments (e.g. Halerium).
//
// NEXT_PUBLIC_BASE_PATH is set at build time in start.sh when HALERIUM_ID is present.
// Next.js <Link> and router.push() automatically prepend basePath — only fetch()
// calls need this constant (via getApiBase()).
export const BASE_PATH: string =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function getApiBase(): string {
  return `${BASE_PATH}/api`;
}
