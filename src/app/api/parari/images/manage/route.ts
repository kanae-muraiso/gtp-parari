import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { isLegacyBookSsot, isReferenceBookSsot } from "@/lib/parari/book/pageRefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "check" | "references" | "delete";

function getBearerToken(request: NextRequest): string | null {
  const parts = (request.headers.get("authorization") ?? "").trim().split(/\s+/);
  return parts.length === 2 && parts[0].toLowerCase() === "bearer" ? parts[1] : null;
}

function normalizePaths(value: unknown, userId: string): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) return null;

  const paths = [...new Set(value.map((item) => String(item ?? "").trim()))];
  if (paths.length !== value.length) return null;

  for (const path of paths) {
    if (
      path.length > 1024 ||
      !path.startsWith(userId + "/") ||
      path.endsWith("/") ||
      path.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) return null;
  }
  return paths;
}

function escapeRegExp(value: string): string {
  return value.split("").map((character) => "\\^$.*+?()[]{}|".includes(character) ? "\\" + character : character).join("");
}

async function loadReferenceDocuments(): Promise<string[]> {
  const documents: string[] = [];
  const sources = [
    ["parari_books", "content"],
    ["profiles", "avatar_url,cover_image_url,homepage_header_logo_url,public_page_draft,public_page_published,public_page_ideas"],
    ["parari_public_work_cards", "cover_image"],
    ["cpp_companies", "logo_path"],
    ["cpp_profiles", "photo_path"],
    ["parari_social_profiles", "photo_url"],
  ] as const;

  for (const [table, columns] of sources) {
    let from = 0;
    const pageSize = 200;
    while (true) {
      const { data, error } = await (supabaseAdmin as any)
        .from(table)
        .select(columns)
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Could not inspect image references in " + table);

      const rows = data ?? [];
      for (const row of rows) documents.push(JSON.stringify(row));
      if (rows.length < pageSize) break;
      from += pageSize;
    }
  }

  return documents;
}

async function findUsingWorks(path: string, userId: string): Promise<Array<{ id: string; title: string; href: string }>> {
  const variants = [path, path.split("/").map(encodeURIComponent).join("/")];
  const works: Array<{ id: string; title: string; href: string }> = [];
  let from = 0;
  const pageSize = 200;

  while (true) {
    const { data, error } = await (supabaseAdmin as any)
      .from("parari_books")
      .select("id,title,content")
      .eq("owner", userId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Could not inspect the user's works");

    const rows = data ?? [];
    for (const row of rows) {
      const content = String(row.content ?? "");
      if (variants.some((variant) => content.includes(variant))) {
        const id = String(row.id);
        const content = String(row.content ?? "");
        const href = isReferenceBookSsot(content)
          ? "/editor/book/" + encodeURIComponent(id)
          : isLegacyBookSsot(content)
            ? "/editor-v2/" + encodeURIComponent(id)
            : "/writing/" + encodeURIComponent(id) + (/^\s*\[(WEB|WEBINFO)\b/i.test(content) ? "?mode=editing" : "");
        works.push({ id, title: String(row.title ?? "").trim() || "無題の作品", href });
      }
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return works;
}

async function findUsedPaths(paths: string[]): Promise<Set<string>> {
  const documents = await loadReferenceDocuments();
  const variants = new Map<string, string>();

  for (const path of paths) {
    variants.set(path, path);
    variants.set(path.split("/").map(encodeURIComponent).join("/"), path);
  }

  const patterns = Array.from(variants.keys())
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const matcher = new RegExp(patterns.join("|"), "g");
  const used = new Set<string>();

  for (const document of documents) {
    matcher.lastIndex = 0;
    for (const match of document.matchAll(matcher)) {
      const path = variants.get(match[0]);
      if (path) used.add(path);
    }
    if (used.size === paths.length) break;
  }

  return used;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, message: "ログインしてください。" }, { status: 401 });
  }

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) {
    return NextResponse.json({ ok: false, message: "ログイン状態を確認できませんでした。" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { action?: unknown; paths?: unknown } | null;
  const action = body?.action as Action;
  if (action !== "check" && action !== "references" && action !== "delete") {
    return NextResponse.json({ ok: false, message: "操作を確認できませんでした。" }, { status: 400 });
  }

  const paths = normalizePaths(body?.paths, auth.user.id);
  if (!paths) {
    return NextResponse.json({ ok: false, message: "画像の指定が正しくありません。" }, { status: 400 });
  }

  try {
    if (action === "references") {
      if (paths.length !== 1) {
        return NextResponse.json({ ok: false, message: "画像を1つ指定してください。" }, { status: 400 });
      }
      const path = paths[0];
      const [used, works] = await Promise.all([
        findUsedPaths([path]),
        findUsingWorks(path, auth.user.id),
      ]);
      return NextResponse.json({
        ok: true,
        inUse: used.has(path),
        works,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const used = await findUsedPaths(paths);

    if (action === "check") {
      return NextResponse.json({
        ok: true,
        usage: Object.fromEntries(paths.map((path) => [path, used.has(path)])),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (used.size > 0) {
      return NextResponse.json({
        ok: false,
        message: "作品やプロフィールで使用中の画像は削除できません。",
        usedPaths: Array.from(used),
      }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }

    const { error: deleteError } = await supabaseAdmin.storage
      .from("parari-images")
      .remove(paths);
    if (deleteError) {
      console.error("[api/parari/images/manage] storage delete failed:", deleteError);
      return NextResponse.json({ ok: false, message: "画像を削除できませんでした。" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[api/parari/images/manage] reference check failed:", error);
    return NextResponse.json({
      ok: false,
      message: "画像の使用状況を確認できないため、削除を停止しました。",
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
