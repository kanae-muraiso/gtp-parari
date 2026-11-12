// STUDIO pause is a paid-contract-sensitive action. Never trust client-side
// plan checks; reconcile Stripe first and enforce in both the API and database.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { syncUserBillingWithStripe } from "@/lib/billing/stripeSync";
import { getPlanLabel, getEffectivePlan } from "@/lib/billing/plan";
import type { UserBillingRow } from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasUnfinishedPaidContract(billing: UserBillingRow): boolean {
  return (
    ["active", "trialing", "past_due", "unpaid"].includes(billing.billing_status) &&
    (billing.plan !== "free" || Boolean(billing.stripe_subscription_id))
  );
}

function blockedMessage(billing: UserBillingRow): string {
  const label = getPlanLabel(getEffectivePlan(billing));
  if (billing.cancel_at_period_end && billing.current_period_end) {
    const until = new Date(billing.current_period_end).toLocaleDateString("ja-JP");
    return `有料プランは${until}まで有効です。契約終了後にFreeへ戻ると、STUDIOを休止できます。`;
  }
  if (billing.billing_status === "past_due" || billing.billing_status === "unpaid") {
    return "未決済の契約情報があります。請求管理で契約状態をご確認ください。契約が終了しFreeに戻るとSTUDIOを休止できます。";
  }
  return `現在は${label}の契約中です。Freeプランへ戻ってからSTUDIOを休止できます。`;
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handle(request: NextRequest, pause: boolean) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ ok: false, message: "ログインが必要です。" }, 401);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ ok: false, message: "ログイン状態を確認できませんでした。" }, 401);

    // A pending cancellation is still paid until Stripe reports it ended.
    const billing = await syncUserBillingWithStripe(user.id);
    if (hasUnfinishedPaidContract(billing)) {
      return json({
        ok: false,
        canPause: false,
        code: "PAID_PLAN_ACTIVE",
        message: blockedMessage(billing),
      }, pause ? 409 : 200);
    }

    if (!pause) return json({ ok: true, canPause: true });

    const { error } = await supabaseAdmin.from("user_workspace_preferences").upsert({
      user_id: user.id,
      studio_enabled: false,
      studio_paused: true,
      start_destination: "library",
      last_workspace: "library",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      console.error("[studio/pause] preference write failed", error);
      return json({ ok: false, message: "STUDIOを休止できませんでした。契約状態を再確認してください。" }, 409);
    }

    return json({ ok: true, canPause: true, paused: true });
  } catch (error) {
    console.error("[studio/pause] billing verification failed", error);
    return json({ ok: false, message: "契約状況を確認できませんでした。後ほど再度お試しください。" }, 503);
  }
}

export async function GET(request: NextRequest) {
  return handle(request, false);
}

export async function POST(request: NextRequest) {
  return handle(request, true);
}
