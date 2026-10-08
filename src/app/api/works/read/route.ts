// src/app/api/works/read/route.ts
// 2026-10-08 JST / PART: Authenticated public reading projection
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { loadReader } from "@/lib/commerce/readerAccess";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        let userId: string | null = null;
        if (token) {
            const { data, error } = await supabaseAdmin.auth.getUser(token);
            if (error || !data.user)
                return NextResponse.json({ message: "ログイン状態を確認してください。" }, { status: 401, headers });
            userId = data.user.id;
        }
        const p = request.nextUrl.searchParams;
        const result = await loadReader({ id: p.get("id") ?? undefined, username: p.get("username") ?? undefined, workSlug: p.get("workSlug") ?? undefined, pageSlug: p.get("pageSlug") }, userId);
        return NextResponse.json(result ?? { message: "作品が見つからないか、閲覧権がありません。" }, { status: result ? 200 : 404, headers });
    }
    catch (error) {
        console.error("[works/read]", error);
        return NextResponse.json({ message: "作品を読み込めませんでした。もう一度お試しください。" }, { status: 503, headers });
    }
}
