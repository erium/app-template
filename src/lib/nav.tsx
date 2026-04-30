"use client";
/* eslint-disable react-refresh/only-export-components */

// Drop-in replacements for next/link and next/navigation that prepend
// NEXT_PUBLIC_BASE_PATH to every client-visible URL. Required because Halerium's
// nginx mounts each app under `/apps/<runner>/<port>/` and STRIPS that prefix
// before forwarding to the dev/prod server — so basePath in next.config.ts
// would make the server reject every request. Instead we leave basePath empty
// (server responds at bare paths), use assetPrefix for static assets, and use
// these wrappers so links and router pushes carry the prefix in the URL bar.
//
// Always import from `@/lib/nav` instead of `next/link` / `next/navigation`.
// Direct imports break navigation: <Link href="/login"> would push the bare
// path to the URL bar, the proxy wouldn't recognize the URL on refresh, and
// the user would land on a 404.

import NextLink, { type LinkProps } from "next/link";
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
} from "next/navigation";
import * as React from "react";

const PREFIX = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

function withPrefix(href: string): string {
  if (!PREFIX) return href;
  if (!href.startsWith("/")) return href;
  if (href === PREFIX || href.startsWith(`${PREFIX}/`)) return href;
  return PREFIX + href;
}

function stripPrefix(pathname: string | null): string {
  if (!pathname) return "/";
  if (!PREFIX) return pathname;
  if (pathname === PREFIX) return "/";
  if (pathname.startsWith(`${PREFIX}/`)) return pathname.slice(PREFIX.length) || "/";
  return pathname;
}

type Href = LinkProps["href"];

export const Link = React.forwardRef<
  HTMLAnchorElement,
  React.PropsWithChildren<
    Omit<LinkProps, "href"> & { href: Href; className?: string }
  >
>(function Link({ href, ...rest }, ref) {
  const adjusted = typeof href === "string" ? withPrefix(href) : href;
  return <NextLink ref={ref} href={adjusted} {...rest} />;
});

export function useRouter() {
  const router = useNextRouter();
  return React.useMemo(
    () => ({
      ...router,
      push: (href: string, opts?: Parameters<typeof router.push>[1]) =>
        router.push(withPrefix(href), opts),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) =>
        router.replace(withPrefix(href), opts),
      prefetch: (href: string) => router.prefetch(withPrefix(href)),
    }),
    [router],
  );
}

export function usePathname(): string {
  return stripPrefix(useNextPathname());
}

export default Link;
