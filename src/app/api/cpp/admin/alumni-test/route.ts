import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cppTestLabels, type CppTestScenario } from "@/lib/cppTestSession";

export const runtime = "nodejs";
export const maxDuration = 60;
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return response({ error: "ログインが必要です。" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return response({ error: "テスト用認証の接続設定を確認してください。" }, 503);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } };
  const caller = createClient(url, anon, { ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, service, options);
  try {
    const { data: auth, error: authError } = await caller.auth.getUser(token);
    if (authError || !auth.user) return response({ error: "ログインを確認してください。" }, 401);
    const { data: mode, error: modeError } = await caller.rpc("cpp_mode_status");
    if (modeError || mode?.[0]?.mode !== "admin") return response({ error: "管理者モード限定です。" }, 403);
    const body = await request.json().catch(() => null);
    const scenario = body?.scenario as CppTestScenario;
    if (!Object.hasOwn(cppTestLabels, scenario)) return response({ error: "テストする立場を選択してください。" }, 400);
    const { data: existing, error: lookupError } = await caller.rpc("cpp_alumni_test_account");
    if (lookupError) return response({ error: "テストアカウントを確認できませんでした。" }, 503);
    let userId: string = existing;
    let createdHere = false;
    if (!userId) {
      const created = await admin.auth.admin.createUser({
        email: `cpp-test-${randomUUID()}@example.invalid`,
        email_confirm: true,
        app_metadata: { cpp_test_owner: auth.user.id },
        user_metadata: { display_name: "CPP テスト会員" },
      });
      if (created.error || !created.data.user) return response({ error: "テストアカウントを作成できませんでした。" }, 503);
      userId = created.data.user.id;
      createdHere = true;
    }
    const prepared = await caller.rpc("cpp_prepare_alumni_test", { p_test_user: userId, p_scenario: scenario });
    if (prepared.error) {
      // Clean up only this request's unused account, never a registered account.
      if (createdHere) {
        const current = await caller.rpc("cpp_alumni_test_account");
        if (!current.error && current.data !== userId) await admin.auth.admin.deleteUser(userId);
      }
      return response({ error: prepared.error.message }, 409);
    }
    const account = await admin.auth.admin.getUserById(userId);
    if (account.error || account.data.user?.app_metadata.cpp_test_owner !== auth.user.id || !account.data.user.email) return response({ error: "専用テストアカウントを確認できませんでした。" }, 403);
    // generateLink does not send an email. Only the caller's dedicated test user is eligible.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: account.data.user.email });
    if (link.error || link.data.user?.id !== userId || !link.data.properties?.hashed_token) return response({ error: "テスト用ログインを準備できませんでした。" }, 503);
    return response({ tokenHash: link.data.properties.hashed_token, userId });
  } catch {
    return response({ error: "テストの準備に失敗しました。時間をおいてお試しください。" }, 503);
  }
}
