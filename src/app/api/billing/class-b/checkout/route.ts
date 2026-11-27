import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { CLASS_B_BLOCK_PRICE_JPY } from "@/lib/classBPolicy";

export const runtime = "nodejs";

const reply = (body: object, status = 200) =>
  NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store"}});

export async function POST(request: NextRequest) {
  // Keep checkout closed until the independent subscription ledger,
  // webhook reconciliation and duplicate-purchase safeguards are deployed.
  if (process.env.CLASS_B_CHECKOUT_ENABLED !== "true") {
    return reply({ok:false,message:"CLASS Bの購入受付は準備中です。"},503);
  }
  // This stage intentionally cannot create a Stripe Checkout session.
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ok:false,message:"ログインしてください。"},401);
  const {data:{user},error:authError} = await db.auth.getUser(token);
  if (authError || !user) return reply({ok:false,message:"ログインしてください。"},401);
  const body = await request.json().catch(()=>null);
  const schoolId = body?.schoolId;
  const quantity = body?.quantity;
  if (typeof schoolId !== "string" || !classIdPattern.test(schoolId) ||
      typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000)
    return reply({ok:false,message:"事業と契約数量を確認してください。"},400);
  try {
    const {data:school,error} = await db.from("class_schools").select("id")
      .eq("id",schoolId).eq("owner_user_id",user.id).is("archived_at",null).maybeSingle();
    if (error) throw error;
    if (!school) return reply({ok:false,message:"事業が見つかりません。"},404);
    const priceId = process.env.STRIPE_CLASS_B_JPY_PRICE_ID?.trim();
    if (!priceId) return reply({ok:false,message:"CLASS Bの価格は準備中です。"},503);
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.currency !== "jpy" || price.unit_amount !== CLASS_B_BLOCK_PRICE_JPY ||
        price.type !== "recurring" || price.recurring?.interval !== "month" ||
        price.recurring.interval_count !== 1 || price.billing_scheme !== "per_unit" ||
        price.recurring.usage_type !== "licensed" ||
        (process.env.VERCEL_ENV === "production" && !price.livemode)) {
      return reply({ok:false,message:"CLASS Bの価格設定を確認できません。"},503);
    }
    // Payment session creation is deliberately gated pending atomic
    // reservation of a per-school contract and signed webhook support.
    return reply({ok:false,message:"CLASS Bの契約受付は準備中です。"},503);
  } catch(error) {
    console.error("[class-b checkout] validation failed",error);
    return reply({ok:false,message:"契約の準備状況を確認できませんでした。"},503);
  }
}
