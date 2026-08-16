// src/lib/billing/stripe.ts
// 2026-05-16 17:55 JST

// パーツ名：Stripe SDK 初期化
// コメント：
// Stripe Checkout / Customer Portal / Webhook から共通利用するStripeクライアント。
// STRIPE_SECRET_KEY が未設定の場合は、起動時にわかりやすいエラーを出す。

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

/**
 * PART: Stripe SDK client
 * コメント：
 * - インストール済み stripe SDK の型定義に合わせて apiVersion を指定します。
 */

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});
