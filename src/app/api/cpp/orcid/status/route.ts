import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { authenticatedUser, orcidConfig } from "@/lib/cpp/orcid";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
  try {
    const { environment } = orcidConfig();
    const { data, error } = await supabaseAdmin.from("cpp_orcid_identities")
      .select("orcid_id,verified_at,environment")
      .eq("user_id", user.id).eq("environment", environment).maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      verified: data?.environment === environment && environment === "production",
      orcidId: data?.environment === environment && environment === "production" ? data.orcid_id : null,
      verifiedAt: data?.environment === environment && environment === "production" ? data.verified_at : null,
    });
  } catch (error) {
    console.error("[cpp/orcid/status]", error);
    return NextResponse.json({ message: "ORCID認証の状態を確認できませんでした。" }, { status: 503 });
  }
}
