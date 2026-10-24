// src/app/api/commerce/purchase-status/route.ts
// 2026-10-08 JST / PART: Read-only payment confirmation, never trust redirect parameters
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { validEntitlement, validSubscription } from "@/lib/commerce/paywall";
export async function GET(request: NextRequest) {
    const headers = { "Cache-Control": "private, no-store" };
    try {
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token)
            return NextResponse.json({ message: "ログインが必要です。" }, { status: 401, headers });
        const { data: { user }, error } = await db.auth.getUser(token);
        if (error || !user)
            return NextResponse.json({ message: "ログインが必要です。" }, { status: 401, headers });
        const productId = request.nextUrl.searchParams.get("productId");
        const [rights, subscriptions] = await Promise.all([
            db.from("commerce_entitlements").select("status,starts_at,expires_at,remaining_uses").eq("user_id", user.id).eq("product_id", productId),
            db.from("commerce_subscriptions").select("access_until").eq("buyer_user_id", user.id).eq("product_id", productId)
        ]);
        if (rights.error || subscriptions.error)
            throw rights.error || subscriptions.error;
        return NextResponse.json({ owned: (rights.data ?? []).some(e => validEntitlement(e)) || (subscriptions.data ?? []).some(s => validSubscription(s)) }, { headers });
    }
    catch {
        return NextResponse.json({ message: "決済の反映を確認できませんでした。" }, { status: 503, headers });
    }
}
