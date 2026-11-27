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
    // Keep the second release gate closed until the webhook and ledger have
    // been tested together. Never enable checkout based on a client parameter.
    if (process.env.CLASS_B_CONTRACT_LEDGER_READY !== "true") {
      return reply({ok:false,message:"CLASS Bの契約受付は準備中です。"},503);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
    if (!appUrl) return reply({ok:false,message:"サービスのURL設定を確認してください。"},503);
    const {data:entitlement,error:entitlementError} = await db.from("class_feature_plans")
      .select("plan,active_until").eq("school_id",schoolId).maybeSingle();
    if (entitlementError) throw entitlementError;
    if (entitlement?.plan === "b" && (!entitlement.active_until || Date.parse(entitlement.active_until)>Date.now()))
      return reply({ok:false,message:"この事業はすでにCLASS Bをご契約中です。"},409);
    // Atomic primary-key reservation prevents concurrent purchases for one school.
    const reservation = await db.from("class_b_contracts").insert({
      school_id:schoolId,owner_user_id:user.id,requested_blocks:quantity
    }).select("attempt_id,created_at").single();
    if (reservation.error?.code === "23505") {
      const existing = await db.from("class_b_contracts")
        .select("status,requested_blocks,stripe_checkout_session_id,stripe_subscription_id")
        .eq("school_id",schoolId).eq("owner_user_id",user.id).maybeSingle();
      if (existing.error) throw existing.error;
      const contract = existing.data;
      if (contract?.status === "pending" && !contract.stripe_subscription_id &&
          contract.stripe_checkout_session_id) {
        const prior = await stripe.checkout.sessions.retrieve(contract.stripe_checkout_session_id);
        if (prior.metadata?.class_b_school_id !== schoolId ||
            prior.metadata?.supabase_user_id !== user.id || prior.metadata?.plan !== "class_b")
          throw new Error("Mismatched CLASS B checkout reservation");
        if (prior.status === "open" && prior.url) {
          if (contract.requested_blocks !== quantity)
            return reply({ok:false,message:"購入手続き中の契約数量と異なります。元の数量で再開してください。"},409);
          return reply({ok:true,url:prior.url,resumed:true});
        }
      }
      return reply({ok:false,message:"この事業には既存の契約または購入手続きがあります。"},409);
    }
    if (reservation.error || !reservation.data) throw reservation.error ?? new Error("Missing contract reservation");
    const attempt = reservation.data.attempt_id;
    const metadata = {plan:"class_b",class_b_school_id:schoolId,class_b_attempt_id:attempt,supabase_user_id:user.id};
    // No shared WRITERS customer is supplied: this subscription is independent.
    const session = await stripe.checkout.sessions.create({
      mode:"subscription",currency:"jpy",locale:"ja",
      line_items:[{price:priceId,quantity}],
      customer_email:user.email ?? undefined,
      client_reference_id:schoolId,
      metadata,subscription_data:{metadata},
      allow_promotion_codes:false,
      adaptive_pricing:{enabled:false},
      success_url:`${appUrl}/billing?class_b_checkout=success`,
      cancel_url:`${appUrl}/billing?class_b_checkout=cancel`,
    },{idempotencyKey:`class-b-checkout-${attempt}`});
    const saved = await db.from("class_b_contracts").update({
      stripe_checkout_session_id:session.id,updated_at:new Date().toISOString()
    }).eq("school_id",schoolId).eq("attempt_id",attempt).eq("status","pending");
    if (saved.error) throw saved.error;
    if (!session.url) throw new Error("Missing CLASS B Checkout URL");
    return reply({ok:true,url:session.url});
  } catch(error) {
    console.error("[class-b checkout] validation failed",error);
    return reply({ok:false,message:"契約の準備状況を確認できませんでした。"},503);
  }
}
