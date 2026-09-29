import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export type OrcidEnvironment = "sandbox" | "production";

export function orcidConfig() {
  const environment = process.env.ORCID_ENVIRONMENT;
  const clientId = process.env.ORCID_CLIENT_ID?.trim();
  const clientSecret = process.env.ORCID_CLIENT_SECRET?.trim();
  const redirectUri = process.env.ORCID_REDIRECT_URI?.trim();
  if ((environment !== "sandbox" && environment !== "production") || !clientId || !clientSecret || !redirectUri) {
    throw new Error("ORCID OAuth environment variables are incomplete.");
  }
  const parsed = new URL(redirectUri);
  if (parsed.pathname !== "/api/cpp/orcid/callback" || parsed.search || parsed.hash ||
      (parsed.protocol !== "https:" && !(environment === "sandbox" && parsed.protocol === "http:"))) {
    throw new Error("ORCID_REDIRECT_URI must be an exact callback URL.");
  }
  return {
    environment,
    clientId,
    clientSecret,
    redirectUri,
    origin: environment === "sandbox" ? "https://sandbox.orcid.org" : "https://orcid.org",
  };
}

export function stateHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function authenticatedUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

export function registrationUrl(request: NextRequest, result: string) {
  const url = new URL("/cpp/try", request.nextUrl.origin);
  url.searchParams.set("orcid", result);
  return url;
}
