import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { orcidConfig, registrationUrl, stateHash } from "@/lib/cpp/orcid";

export const runtime = "nodejs";

function finish(request: NextRequest, result: string) {
  const response = NextResponse.redirect(registrationUrl(request, result), 303);
  response.cookies.set("cpp_orcid_state", "", { path: "/api/cpp/orcid/callback", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();
  const cookie = request.cookies.get("cpp_orcid_state")?.value ?? "";
  const matches = Boolean(state && cookie && state.length === cookie.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(cookie)));
  if (!matches) return finish(request, "invalid-state");
  if (request.nextUrl.searchParams.has("error") || !code) {
    return finish(request, "cancelled");
  }

  try {
    const config = orcidConfig();
    const { data: consumed, error: stateError } = await supabaseAdmin
      .from("cpp_orcid_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state_hash", stateHash(state))
      .eq("environment", config.environment)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("user_id").maybeSingle();
    if (stateError || !consumed) {
      return finish(request, "invalid-state");
    }

    const response = await fetch(new URL("/oauth/token", config.origin), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`ORCID token exchange failed: ${response.status}`);
    const token: { orcid?: unknown; scope?: unknown } = await response.json();
    if (typeof token.orcid !== "string" ||
        !/^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(token.orcid) ||
        typeof token.scope !== "string" || !token.scope.split(" ").includes("/authenticate")) {
      throw new Error("ORCID did not return an authenticated iD.");
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("cpp_orcid_identities").select("orcid_id")
      .eq("user_id", consumed.user_id).eq("environment", config.environment).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.orcid_id !== token.orcid) {
      return finish(request, "different-account");
    }

    const verifiedAt = new Date().toISOString();
    const { error: saveError } = await supabaseAdmin.from("cpp_orcid_identities").upsert({
      user_id: consumed.user_id,
      orcid_id: token.orcid,
      environment: config.environment,
      verified_at: verifiedAt,
    }, { onConflict: "user_id,environment" });
    if (saveError) {
      if (saveError.code === "23505") return finish(request, "already-linked");
      throw saveError;
    }

    // Existing profiles are synchronized by the database trigger; new profiles
    // receive the verified fields at creation, not from browser-supplied data.
    const { error: profileError } = await supabaseAdmin.from("cpp_profiles")
      .update({ updated_at: verifiedAt }).eq("user_id", consumed.user_id);
    if (profileError) throw profileError;
    return finish(request, "connected");
  } catch (error) {
    console.error("[cpp/orcid/callback]", error);
    return finish(request, "failed");
  }
}
