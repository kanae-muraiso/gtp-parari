// src/proxy.ts
// PART: PARARI username subdomain rewrite
//
// username.parari.app/path
// を既存の /username/path ルートへ内部rewriteする。

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() ||
  "parari.app";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "auth",
  "cdn",
  "docs",
  "editor",
  "help",
  "mail",
  "status",
  "support",
]);

export function proxy(request: NextRequest) {
  const hostname = normalizeHostname(
    request.headers.get("host") ?? "",
  );

  const username = extractUsernameFromHostname(
    hostname,
    ROOT_DOMAIN,
  );

  if (
    !username ||
    RESERVED_SUBDOMAINS.has(username)
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  const encodedUsername =
    encodeURIComponent(username);

  const usernamePrefix =
    `/${encodedUsername}`;

  const pathname =
    url.pathname === "/" ? "" : url.pathname;

  /*
   * PARARI全体で共通の公開作品ルートは、
   * サブドメイン上でもusernameを付けずにそのまま通す。
   *
   * 例:
   * taro-aoyama.parari.app/p/作品ID
   * → 内部でも /p/作品ID
   */
  if (
    pathname === "/p" ||
    pathname.startsWith("/p/")
  ) {
    return NextResponse.next();
  }

  /*
   * /parari/web のように、すでにusernameを含むURLへ
   * redirectされた後は、二重に /parari を追加しない。
   */
  if (
    pathname === usernamePrefix ||
    pathname.startsWith(`${usernamePrefix}/`)
  ) {
    return NextResponse.next();
  }

  url.pathname =
    `${usernamePrefix}${pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};

function normalizeHostname(
  hostname: string,
): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

function extractUsernameFromHostname(
  hostname: string,
  rootDomain: string,
): string | null {
  if (!hostname || !rootDomain) {
    return null;
  }

  if (
    hostname === rootDomain ||
    hostname === `www.${rootDomain}`
  ) {
    return null;
  }

  const productionSuffix =
    `.${rootDomain}`;

  if (hostname.endsWith(productionSuffix)) {
    const subdomain = hostname.slice(
      0,
      -productionSuffix.length,
    );

    return isSingleValidUsername(subdomain)
      ? subdomain
      : null;
  }

  return extractLocalUsername(hostname);
}

function extractLocalUsername(
  hostname: string,
): string | null {
  for (const suffix of [
    ".localhost",
    ".lvh.me",
  ]) {
    if (!hostname.endsWith(suffix)) {
      continue;
    }

    const subdomain = hostname.slice(
      0,
      -suffix.length,
    );

    return isSingleValidUsername(subdomain)
      ? subdomain
      : null;
  }

  return null;
}

function isSingleValidUsername(
  value: string,
): boolean {
  if (
    !value ||
    value.includes(".")
  ) {
    return false;
  }

  return /^(?=.{5,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value,
  );
}
