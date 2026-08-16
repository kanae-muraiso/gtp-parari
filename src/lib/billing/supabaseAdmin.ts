// src/lib/billing/supabaseAdmin.ts
// 2026-05-16 18:05 JST

// パーツ名：Supabase Admin Client
// コメント：
// Stripe Checkout / Webhook など、サーバー側APIから user_billing を更新するためのSupabaseクライアント。
// SUPABASE_SERVICE_ROLE_KEY を使うため、絶対にブラウザ側コンポーネントから import しない。

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
