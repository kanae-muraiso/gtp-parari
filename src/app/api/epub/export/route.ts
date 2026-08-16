// src/app/api/epub/export/route.ts
// PART: authenticated EPUB3 export
//
// 出力可能:
// - Monitor
// - Plus
// - Pro
//
// 出力不可:
// - Free
//
// EPUBはクライアントから送られたSSOTではなく、
// parari_booksに保存済みのSSOTから生成する。

import { NextRequest, NextResponse } from "next/server";

import { getEffectivePlan } from "@/lib/billing/plan";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";
import { buildEpubModel } from "@/lib/parari/epub/buildEpubModel";
import { buildEpub } from "@/lib/parari/epub/buildEpub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportEpubBody = {
  workId?: unknown;
};

type WorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  is_deleted: boolean | null;
};

type MonitorProfileRow = {
  is_monitor: boolean | null;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const matched = authorization.match(/^Bearer\s+(.+)$/i);

  return matched?.[1] ?? null;
}

function normalizeWorkId(value: unknown): string | null {
  const workId = String(value ?? "").trim();

  if (!workId || workId.length > 200) {
    return null;
  }

  return workId;
}

async function getIsMonitorUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_monitor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[api/epub/export] monitor profile load failed:",
      error,
    );

    throw new Error("Failed to load monitor profile");
  }

  return (data as MonitorProfileRow | null)?.is_monitor === true;
}

function createContentDisposition(filename: string): string {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "EPUB3を出力するにはログインが必要です。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログイン情報を確認できませんでした。",
        },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | ExportEpubBody
      | null;

    const workId = normalizeWorkId(body?.workId);

    if (!workId) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品IDが正しくありません。",
        },
        { status: 400 },
      );
    }

    /*
     * owner条件を付け、他人の作品を出力できないようにする。
     */
    const { data, error } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,title,content,is_deleted")
      .eq("id", workId)
      .eq("owner", user.id)
      .maybeSingle();

    if (error) {
      console.error("[api/epub/export] work load failed:", error);

      return NextResponse.json(
        {
          ok: false,
          message: "作品情報を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    const work = data as WorkRow | null;

    if (!work || work.is_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message: "EPUB3出力対象の作品が見つかりませんでした。",
        },
        { status: 404 },
      );
    }

    const [isMonitor, billing] = await Promise.all([
      getIsMonitorUser(user.id),
      getUserBillingByUserId(user.id),
    ]);

    const effectivePlan = getEffectivePlan(billing);

    const canExportEpub =
      isMonitor ||
      effectivePlan === "plus" ||
      effectivePlan === "pro";

    if (!canExportEpub) {
      return NextResponse.json(
        {
          ok: false,
          code: "EPUB_EXPORT_REQUIRES_PLUS",
          plan: effectivePlan,
          message:
            "EPUB3出力はPlusプラン（月5ドル）で利用できます。",
        },
        { status: 403 },
      );
    }

    const ssot = String(work.content ?? "").trim();

    if (!ssot) {
      return NextResponse.json(
        {
          ok: false,
          message: "EPUB3へ出力できる本文がありません。",
        },
        { status: 400 },
      );
    }

    const model = buildEpubModel(ssot);
    const result = await buildEpub(model);
    const arrayBuffer = await result.blob.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": createContentDisposition(result.filename),
        "Cache-Control": "no-store",
        "X-Parari-Epub-Warnings": encodeURIComponent(
          result.warnings.join("\n"),
        ),
      },
    });
  } catch (error) {
    console.error("[api/epub/export] unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "EPUB3の生成中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
