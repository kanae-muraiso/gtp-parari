import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { authenticatedUser, orcidConfig, stateHash } from "@/lib/cpp/orcid";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });

  try {
    const config = orcidConfig();
    const state = randomBytes(32).toString("base64url");
    const { error } = await supabaseAdmin.from("cpp_orcid_oauth_states").insert({
      user_id: user.id,
      state_hash: stateHash(state),
      environment: config.environment,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw error;

    const url = new URL("/oauth/authorize", config.origin);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "/authenticate");
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    const result = NextResponse.json({ url: url.toString() });
    result.cookies.set("cpp_orcid_state", state, {
      httpOnly: true,
      secure: config.environment === "production" || config.redirectUri.startsWith("https:"),
      sameSite: "lax",
      path: "/api/cpp/orcid/callback",
      maxAge: 600,
    });
    return result;
  } catch (error) {
    console.error("[cpp/orcid/start]", error);
    return NextResponse.json({ message: "ORCID認証を開始できませんでした。" }, { status: 503 });
  }
}
