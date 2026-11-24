import { NextRequest, NextResponse } from "next/server";
import { compileAuthorizedWork } from "@/lib/parari/reader/compileAuthorizedWork";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

type BookRow = {
  id: string;
  owner: string;
  content: string | null;
  is_public: boolean | null;
  visibility: string | null;
  is_deleted: boolean | null;
  expires_at: string | null;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const matched = authorization.match(/^Bearer\s+(.+)$/i);
  return matched?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const workId = String(
      request.nextUrl.searchParams.get("workId") ?? "",
    ).trim();

    if (!workId) {
      return NextResponse.json(
        { ok: false, message: "BOOK IDが必要です。" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,content,is_public,visibility,is_deleted,expires_at")
      .eq("id", workId)
      .maybeSingle<BookRow>();

    if (error || !data || data.is_deleted === true ||
        (data.expires_at && Date.parse(data.expires_at) <= Date.now())) {
      return NextResponse.json(
        { ok: false, message: "BOOKが見つかりませんでした。" },
        { status: 404 },
      );
    }

    // Canonical visibility takes priority; legacy is_public is only a fallback.
    const isVisible =
      data.visibility === "public" ||
      data.visibility === "unlisted" ||
      (!data.visibility && data.is_public === true);

    let userId: string | null = null;
    const token = getBearerToken(request);

    if (token) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const canReadPrivateBook = userId === data.owner;
    // An active sale disables unauthenticated reading, even if the source
    // BOOK still has public/unlisted visibility.
    const { data: activeSale, error: saleError } = await supabaseAdmin
      .from("commerce_products")
      .select("id")
      .eq("work_id", data.id)
      .eq("product_type", "work")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (saleError) {
      return NextResponse.json(
        { ok: false, message: "閲覧権限を確認できませんでした。" },
        { status: 503 },
      );
    }
    let allowed = (isVisible && !activeSale) || canReadPrivateBook;

    if (!allowed && userId) {
      const { data: collaborator } = await supabaseAdmin
        .from("parari_work_collaborators")
        .select("role")
        .eq("work_id", data.id)
        .eq("user_id", userId)
        .maybeSingle();

      allowed = collaborator?.role === "editor";
    }

    if (!allowed && userId) {
      const now = new Date().toISOString();
      const { data: entitlement } = await supabaseAdmin
        .from("commerce_entitlements")
        .select("id,remaining_uses")
        .eq("user_id", userId)
        .eq("work_id", data.id)
        .eq("status", "active")
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .maybeSingle();

      const remainingUses = entitlement?.remaining_uses;
      allowed =
        Boolean(entitlement) &&
        (
          remainingUses === null ||
          remainingUses === undefined ||
          Number(remainingUses) > 0
        );
    }

    if (!allowed) {
      return NextResponse.json(
        { ok: false, message: "このBOOKを表示する権限がありません。" },
        { status: 403 },
      );
    }

    const compiled = await compileAuthorizedWork(data, userId);
    if (compiled.error) {
      return NextResponse.json({ok:false, message:"BOOKを読み込めませんでした。"}, {status:503});
    }
    if (!compiled.reader) {
      return NextResponse.json({ok:false, message:"このBOOKの表示形式を準備できませんでした。"}, {status:422});
    }
    return NextResponse.json({
      ok: true,
      reader: compiled.reader,
      missingPageIds: compiled.missingPageIds,
    }, {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    console.error("[book-resolve] unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "BOOKの読み込み中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}
