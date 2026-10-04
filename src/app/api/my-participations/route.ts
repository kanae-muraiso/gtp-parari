// 2026-10-04 JST
// PART: Authenticated return destinations; no work content or permission mutations.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { buildParticipations } from "@/lib/participation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ ok: false, message: "ログインが必要です。" }, { status: 401, headers });
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ ok: false, message: "ログイン状態を確認してください。" }, { status: 401, headers });
    // Existing RPCs must run with this user's JWT, never the service-role identity.
    const actor = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false },
    });
    const [members, alumni, researcher, mode, company, cpp] = await Promise.all([
      supabaseAdmin.from("membership_members").select("membership_id").eq("user_id", user.id).eq("status", "active"),
      actor.rpc("cpp_alumni_participation_status"),
      actor.rpc("cpp_researcher_registration_status"),
      actor.rpc("cpp_mode_status"),
      supabaseAdmin.from("cpp_company_members").select("company_id").eq("user_id", user.id).in("role", ["owner", "editor", "consultant"]).limit(1),
      supabaseAdmin.from("membership_organizations").select("membership_id").in("organization_key", ["CPP-R", "CPP-C"]),
    ]);
    for (const result of [members, alumni, researcher, mode, company, cpp]) if (result.error) throw result.error;
    const ids = [...new Set((members.data ?? []).map(item => item.membership_id))];
    const memberships = ids.length ? await supabaseAdmin.from("memberships").select("id,name").in("id", ids).order("created_at", { ascending: true }) : { data: [], error: null };
    if (memberships.error) throw memberships.error;
    const participations = buildParticipations({
      alumni: alumni.data?.[0] ?? null, researcher: researcher.data?.[0] ?? null,
      mode: mode.data?.[0]?.mode ?? null, hasCompany: !!company.data?.length,
      cppMembershipIds: (cpp.data ?? []).map(item => item.membership_id), memberships: memberships.data ?? [],
    });
    return NextResponse.json({ ok: true, userId: user.id, participations }, { headers });
  } catch (error) {
    console.error("[participations] load failed", error);
    return NextResponse.json({ ok: false, message: "参加先を取得できませんでした。もう一度お試しください。" }, { status: 500, headers });
  }
}
