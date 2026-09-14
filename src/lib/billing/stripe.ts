// src/lib/billing/stripe.ts
// 2026-09-14 JST

// パーツ名：Stripe SDK 初期化
// コメント：
// Stripe Checkout / Customer Portal / Webhook から共通利用するStripeクライアント。
// PreviewなどSTRIPE_SECRET_KEYを持たない環境でも、import時にはbuildを落とさない。
// Stripe APIを実際に利用する環境では、必ずSTRIPE_SECRET_KEYを設定する。

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

/**
 * PART: Stripe SDK client
 * コメント：
 * - Next.js build時にもroute moduleが評価されるため、環境変数未設定を理由に
 *   import時にthrowしない。
 * - 未設定環境でStripe APIを呼ぶと認証エラーになるが、CPP等Stripe非依存の
 *   Preview画面は正常にbuildできる。
 * - 本番/Stripe利用環境ではSTRIPE_SECRET_KEYを必ず設定する。
 */
export const stripe = new Stripe(
  stripeSecretKey ?? "sk_test_preview_not_configured",
  {
    apiVersion: "2025-10-29.clover",
  },
);

export const stripeConfigured = Boolean(stripeSecretKey);
