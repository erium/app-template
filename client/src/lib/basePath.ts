// Base-path detection for reverse-proxy sub-path deployments (e.g. Halerium).
//
// Resolution order:
//   1. `VITE_BASE_PATH` build-time env (e.g. `VITE_BASE_PATH=/apps/org/app`)
//   2. `<base href="...">` tag in index.html (server-injected at request time)
//   3. empty string (app served at root)
//
// Consumers: wouter `<Router base={BASE_PATH}>` and `getApiBase()` below.

function detectBasePath(): string {
  const envBase = import.meta.env.VITE_BASE_PATH?.replace(/\/+$/, "");
  if (envBase) return envBase;

  if (typeof document !== "undefined") {
    const baseEl = document.querySelector("base");
    const href = baseEl?.getAttribute("href");
    if (href) {
      try {
        const url = new URL(href, window.location.origin);
        return url.pathname.replace(/\/+$/, "");
      } catch {
        // fall through
      }
    }
  }
  return "";
}

export const BASE_PATH = detectBasePath();

export function getApiBase(): string {
  return `${BASE_PATH}/api`;
}
