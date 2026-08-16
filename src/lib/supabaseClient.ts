// apps/tools/parari/src/lib/supabaseClient.ts
// apps/tools/parari/src/lib/supabaseClient.ts
// 2026-02-28 19:20 JST

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ✅ import時に throw しない（Turbopackが AbortError になりがち）
// ✅ 代わりに null を返し、呼び出し側でエラーメッセージ表示する
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

// デバッグ用（必要ならMyPageで表示する）
export const supabaseEnvOk = !!(url && anon);
