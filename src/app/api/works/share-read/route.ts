import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-zA-Z0-9_-]{1,128}$/;

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!identifier || identifier.length > 128) {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }

  const byId = uuidPattern.test(identifier);
  if (!byId && !slugPattern.test(identifier)) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }

  // Use the privileged key ONLY inside this server route. Never return hidden
  // rows or entire result sets to a browser.
  let query = supabaseAdmin.from("parari_books")
    .select("id,content,owner,is_public,visibility,slug,stable_slug,custom_slug,render_mode,physical_pagination,is_deleted,expires_at");
  query = byId
    ? query.eq("id", identifier)
    : query.or(["slug", "stable_slug", "custom_slug"]
        .map(field => `${field}.eq.${identifier}`).join(","));
  const { data, error } = await query.limit(2);
  if (error || data?.length !== 1 || data[0].is_deleted ||
      (data[0].expires_at && Date.parse(data[0].expires_at) <= Date.now())) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }

  const work = data[0];
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: auth } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } };
  const userId = auth.user?.id ?? null;
  const isOwner = Boolean(userId && userId === work.owner);

  const publicWork = work.visibility === "public";
  // A random, opaque UUID is the legacy bearer link; short or human-readable
  // slugs MUST NOT authorize access to an unlisted work.
  const unlistedWithBearer = work.visibility === "unlisted" &&
    byId && identifier.toLowerCase() === work.id.toLowerCase();
  // An active sale must never become readable merely because its listing is public.
  const { data: activeSale } = await supabaseAdmin
    .from("commerce_products").select("id")
    .eq("work_id", work.id).eq("product_type", "work")
    .eq("active", true).limit(1).maybeSingle();
  let authorized = (publicWork || unlistedWithBearer) && !activeSale || isOwner;
  let hasPurchasedAccess = false;

  if (!authorized && userId) {
    const { data: collaborator } = await supabaseAdmin
      .from("parari_work_collaborators").select("role")
      .eq("work_id", work.id).eq("user_id", userId).maybeSingle();
    authorized = collaborator?.role === "editor";
  }
  if (!authorized && userId) {
    const now = new Date().toISOString();
    const { data: entitlement } = await supabaseAdmin
      .from("commerce_entitlements").select("id")
      .eq("user_id", userId).eq("work_id", work.id)
      .eq("status", "active").lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or("remaining_uses.is.null,remaining_uses.gt.0")
      .limit(1).maybeSingle();
    authorized = Boolean(entitlement);
    hasPurchasedAccess = authorized;
  }
  if (!authorized) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  return NextResponse.json({
    ok: true, book: {
      id: work.id, content: work.content, owner: work.owner,
      is_public: work.is_public, visibility: work.visibility,
      slug: work.slug, stable_slug: work.stable_slug,
      custom_slug: work.custom_slug, render_mode: work.render_mode,
      physical_pagination: work.physical_pagination, is_deleted: work.is_deleted
    }, hasPurchasedAccess
  }, { headers });
}
