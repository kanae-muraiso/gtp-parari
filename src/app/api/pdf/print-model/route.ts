// Authenticated print-model endpoint. PDF layout is created by the browser's A4 print engine.
import { NextRequest, NextResponse } from "next/server";
import { getEffectivePlan, getPlanEntitlements } from "@/lib/billing/plan";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { buildEpubModel } from "@/lib/parari/epub/buildEpubModel";
import { EpubSourceError, loadEpubSource } from "@/lib/parari/epub/loadEpubSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(value: object, status: number) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply({ message: "PDF出力にはログインが必要です。" }, 401);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return reply({ message: "ログイン情報を確認できませんでした。" }, 401);

    const body = await request.json().catch(() => null) as { workId?: unknown } | null;
    const id = typeof body?.workId === "string" ? body.workId : "";
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(id)) return reply({ message: "作品IDが正しくありません。" }, 400);

    // Match EPUB export's effective plan and monitor entitlement.
    const [billing, profile] = await Promise.all([
      getUserBillingByUserId(user.id),
      supabaseAdmin.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profile.error) throw profile.error;
    const isMonitor = profile.data?.is_monitor === true;
    if (!getPlanEntitlements(getEffectivePlan(billing), isMonitor).canExportEpub) {
      return reply({ message: "PDF出力はEPUB3書き出しと同じ有料プランで利用できます。" }, 403);
    }

    const { data: work, error } = await supabaseAdmin.from("parari_books")
      .select("id,owner,title,content,is_deleted").eq("id", id).eq("owner", user.id).maybeSingle();
    if (error) throw error;
    if (!work || work.is_deleted || !work.content) return reply({ message: "作品が見つかりませんでした。" }, 404);

    const content = await loadEpubSource(work.content, user.id);
    const model = buildEpubModel(content);
    const blocked = model.issues?.filter(issue => issue.blocking) ?? [];
    if (blocked.length) return reply({
      message: "PDF出力できないパネルがあります。出版用パネルセットで確認してください。",
      issues: blocked,
    }, 422);
    return reply({ model }, 200);
  } catch (error) {
    if (error instanceof EpubSourceError) {
      return reply({ message: error.message, code: error.code }, error.status);
    }
    console.error("[api/pdf/print-model] unexpected error", error);
    return reply({ message: "印刷用データを取得できませんでした。" }, 500);
  }
}
