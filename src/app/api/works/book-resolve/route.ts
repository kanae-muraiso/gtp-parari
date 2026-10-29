import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  parseBookPageRefs,
  resolveBookPageRefs,
} from "@/lib/parari/book/pageRefs";

export const runtime = "nodejs";

type BookRow = {
  id: string;
  owner: string;
  content: string | null;
  is_public: boolean | null;
  visibility: string | null;
  is_deleted: boolean | null;
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
      .select("id,owner,content,is_public,visibility,is_deleted")
      .eq("id", workId)
      .maybeSingle<BookRow>();

    if (error || !data || data.is_deleted === true) {
      return NextResponse.json(
        { ok: false, message: "BOOKが見つかりませんでした。" },
        { status: 404 },
      );
    }

    const isVisible =
      data.is_public === true ||
      data.visibility === "public" ||
      data.visibility === "unlisted";

    let userId: string | null = null;
    const token = getBearerToken(request);

    if (token) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    let allowed = isVisible || userId === data.owner;

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

    const source = String(data.content ?? "");
    const refs = parseBookPageRefs(source);

    if (refs.length === 0) {
      return NextResponse.json({
        ok: true,
        resolvedContent: source,
        missingPageIds: [],
      });
    }

    const uniqueIds = Array.from(new Set(refs.map((ref) => ref.id)));

    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,content,is_deleted")
      .in("id", uniqueIds)
      .eq("owner", data.owner);

    if (pagesError) {
      console.error("[book-resolve] page load failed:", pagesError);
      return NextResponse.json(
        { ok: false, message: "BOOKのPAGEを読み込めませんでした。" },
        { status: 500 },
      );
    }

    const pageContentById = new Map<string, string>();

    for (const page of pages ?? []) {
      if (page.is_deleted === true) continue;
      pageContentById.set(
        String(page.id),
        String(page.content ?? ""),
      );
    }

    const missingPageIds = uniqueIds.filter(
      (id) => !pageContentById.has(id),
    );

    return NextResponse.json({
      ok: true,
      resolvedContent: resolveBookPageRefs(
        source,
        pageContentById,
      ),
      missingPageIds,
    });
  } catch (error) {
    console.error("[book-resolve] unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "BOOKの読み込み中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}
