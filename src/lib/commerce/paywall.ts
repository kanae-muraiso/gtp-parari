// src/lib/commerce/paywall.ts
// 2026-10-08 JST
// PART: SSOT paid boundary and paid-through access rules
// Read projections only; the stored SSOT is never truncated.
export function splitPaidContent(source: string) {
    const normalized = source.replace(/\r\n?/g, "\n");
    // Deliberately recognize malformed variants too: damaged boundaries fail closed.
    const match = /\[PAYWALL/i.exec(normalized);
    return { hasPaywall: !!match, preview: match ? normalized.slice(0, match.index) : normalized,
        full: normalized.replace(/^[ \t]*\[PAYWALL\b[^\n]*(?:\n|$)/gim, "") };
}
export function validatePaywall(source: string): string | null {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    let count = 0, carousel = false;
    for (const line of lines) {
        if (/^\s*\[CAROUSEL\b/i.test(line))
            carousel = true;
        if (/^\s*\[\/CAROUSEL\]/i.test(line))
            carousel = false;
        if (/\[PAYWALL/i.test(line)) {
            if (!/^\s*\[PAYWALL\]\s*$/i.test(line))
                return "有料境界は [PAYWALL] の一行で指定してください。";
            if (carousel)
                return "有料境界はカードの外に置いてください。";
            count++;
        }
    }
    if (count > 1)
        return "有料境界は一作品に一つだけ設定できます。";
    // WEB has separate pages rather than a single reading sequence.
    if (count && /^\s*\[WEB(?:INFO)?\b/i.test(source))
        return "有料境界はBOOK・PAGE作品でご利用ください。";
    return null;
}
export function validEntitlement(e: {
    status: string;
    starts_at?: string | null;
    expires_at?: string | null;
    remaining_uses?: number | null;
}, now = Date.now()) {
    return e.status === "active" && (!e.starts_at || Date.parse(e.starts_at) <= now) &&
        (!e.expires_at || Date.parse(e.expires_at) > now) && (e.remaining_uses == null || e.remaining_uses > 0);
}
export function validSubscription(s: {
    access_until?: string | null;
}, now = Date.now()) {
    // Cancellation or a failed renewal does not erase time already paid for.
    return !!s.access_until && Date.parse(s.access_until) > now;
}
export function safeReturnTo(value: unknown, fallback: string) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value))
        return fallback;
    try {
        const url = new URL(value, "https://www.parari.app");
        return url.origin === "https://www.parari.app" ? url.pathname + url.search + url.hash : fallback;
    }
    catch {
        return fallback;
    }
}
