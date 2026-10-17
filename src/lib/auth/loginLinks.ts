// 2026-10-14 JST / PART: Internal return paths and recoverable magic-link errors.
// Expiration is enforced by Supabase Auth, never by this browser helper.
export function loginReturnTo(raw: string | null, fallback = "/mypage"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw)) return fallback;
  try {
    const base = "https://parari.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function loginHref(returnTo: string, reauthenticate = false): string {
  return `/login?returnTo=${encodeURIComponent(loginReturnTo(returnTo))}${reauthenticate ? "&reauth=1" : ""}`;
}

export const expiredLinkMessage = "このログインリンクは期限切れ、または使用済みです。新しいログインメールを申請してください。";
export const failedLinkMessage = "ログインを完了できませんでした。通信状態を確認し、新しいログインメールを申請してください。";

export function callbackLinkError(url: URL): string | null {
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const params of [url.searchParams, hash]) {
    if (params.has("error") || params.has("error_code") || params.has("error_description")) {
      return params.get("error_code") === "otp_expired" ? expiredLinkMessage : failedLinkMessage;
    }
  }
  return null;
}
