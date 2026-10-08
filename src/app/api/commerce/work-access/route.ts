// src/app/api/commerce/work-access/route.ts
// 2026-10-08 JST / PART: Author-owned links between a work and commerce products
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { getUserPlanAccess } from "@/lib/billing/access";
const headers = { "Cache-Control": "private, no-store" };
async function handle(request: NextRequest, save: boolean) {
    try {
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token)
            return NextResponse.json({ message: "ログインが必要です。" }, { status: 401, headers });
        const { data: { user }, error } = await db.auth.getUser(token);
        if (error || !user)
            return NextResponse.json({ message: "ログイン状態を確認してください。" }, { status: 401, headers });
        const body = save ? await request.json() : {};
        const workId = save ? body.workId : request.nextUrl.searchParams.get("workId");
        if (typeof workId !== "string" || !/^[0-9a-f-]{36}$/i.test(workId))
            return NextResponse.json({ message: "作品を確認してください。" }, { status: 400, headers });
        const { data: work, error: we } = await db.from("parari_books").select("id").eq("id", workId).eq("owner", user.id).or("is_deleted.is.null,is_deleted.eq.false").maybeSingle();
        if (we)
            throw we;
        if (!work)
            return NextResponse.json({ message: "作者本人だけが販売設定を変更できます。" }, { status: 403, headers });
        const { data: products, error: pe } = await db.from("commerce_products").select("id,name,work_id,amount,currency,billing_interval,active").eq("owner_user_id", user.id);
        if (pe)
            throw pe;
        if (save) {
            const once = body.oneTimeProductId || null, monthly = body.subscriptionProductId || null;
            const { entitlements } = await getUserPlanAccess(user.id);
            if ((once || monthly) && !entitlements.canUseIntegratedSales || monthly && !entitlements.canUseRecurringSales)
                return NextResponse.json({ message: "この販売方法は現在のプランでは利用できません。月額販売はOrganizer以上です。" }, { status: 403, headers });
            if (once && !products?.some(p => p.id === once && p.work_id === workId && p.billing_interval === "one_time") || monthly && !products?.some(p => p.id === monthly && p.billing_interval === "monthly"))
                return NextResponse.json({ message: "この作者・作品の商品を選んでください。" }, { status: 400, headers });
            const { error: se } = await db.from("commerce_work_access").upsert({ work_id: workId, owner_user_id: user.id, one_time_product_id: once, subscription_product_id: monthly, updated_at: new Date().toISOString() });
            if (se)
                throw se;
        }
        const { data: mapping, error: me } = await db.from("commerce_work_access").select("one_time_product_id,subscription_product_id").eq("work_id", workId).maybeSingle();
        if (me)
            throw me;
        return NextResponse.json({ products, mapping }, { headers });
    }
    catch (error) {
        console.error("[commerce/work-access]", error);
        return NextResponse.json({ message: "販売設定を保存・取得できませんでした。" }, { status: 503, headers });
    }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
