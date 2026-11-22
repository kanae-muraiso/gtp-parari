import { NextRequest, NextResponse } from "next/server";
import { getEffectivePlan, getPlanEntitlements } from "@/lib/billing/plan";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ allowed: false, message: "ログインしてください。" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ allowed: false, message: "ログイン情報を確認できませんでした。" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const [billing, profile] = await Promise.all([
      getUserBillingByUserId(user.id),
      supabaseAdmin.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profile.error) throw profile.error;
    const allowed = getPlanEntitlements(getEffectivePlan(billing), profile.data?.is_monitor === true).canExportEpub;
    return NextResponse.json({ allowed, message: allowed ? "" : "PDFインポートは有料会員向け機能です。" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("[api/pdf/import-access] entitlement check failed", cause);
    return NextResponse.json({ allowed: false, message: "利用資格を確認できませんでした。" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
