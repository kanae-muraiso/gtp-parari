// src/app/api/works/update/route.ts
// 2026-07-11 JST
//
// PARARI作品の保存API。
// ページ数と公開作品数をサーバー側で確認し、
// Free / Plusの上限を超える保存を拒否する。

import { NextRequest, NextResponse } from "next/server";
import {
  getEffectivePlan,
  getPlanLimits,
} from "@/lib/billing/plan";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";

type UpdateWorkBody = {
  workId?: unknown;
  title?: unknown;
  content?: unknown;
  stableSlug?: unknown;
    expectedRevision?: unknown;
};

type CurrentWorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  is_deleted: boolean | null;
  stable_slug: string | null;
    revision: number;
};

type MonitorProfileRow = {
  is_monitor: boolean | null;
};

async function getIsMonitorUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_monitor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[api/works/update] monitor profile load failed:",
      error,
    );
    throw new Error("Failed to load monitor profile");
  }

  return (data as MonitorProfileRow | null)?.is_monitor === true;
}

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

function normalizeTitle(value: unknown): string {
  const title = String(value ?? "").trim();

  return title ? title.slice(0, 300) : "Untitled";
}

function normalizeContent(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  // 異常に大きな更新を防ぐ暫定上限。
  if (value.length > 5_000_000) {
    return null;
  }

  return value;
}

function normalizeExpectedRevision(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return null;
  }

  return value;
}

const SITE_SLUG_RE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SITE_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "editor",
  "editor-v2",
  "login",
  "logout",
  "my",
  "new",
  "p",
  "profile",
  "signup",
  "works",
]);

function normalizeSiteSlug(
  value: unknown,
): string | null {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    slug.length < 3 ||
    slug.length > 50 ||
    !SITE_SLUG_RE.test(slug) ||
    RESERVED_SITE_SLUGS.has(slug)
  ) {
    return null;
  }

  return slug;
}

function isWebContent(
  content: string | null | undefined,
): boolean {
  return /^\s*\[(WEB|WEBINFO)\b/i.test(
    String(content ?? ""),
  );
}

function countPagePanels(content: string | null | undefined): number {
  const source = String(content ?? "").replace(/\r\n/g, "\n");

  return source
    .split("\n")
    .filter((line) =>
      /^\s*\[(PAGE|PAGEINFO)(?::[^\]]+)?\](?:\s|$)/i.test(line),
    )
    .length;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品を保存するにはログインが必要です。",
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
      | UpdateWorkBody
      | null;

      const workId = normalizeWorkId(body?.workId);
      const title = normalizeTitle(body?.title);
      const content = normalizeContent(body?.content);

      const expectedRevision =
        normalizeExpectedRevision(body?.expectedRevision);

      const requestedStableSlug =
        body?.stableSlug === undefined
          ? undefined
          : normalizeSiteSlug(body.stableSlug);

      if (
        !workId ||
        content === null ||
        expectedRevision === null ||
        (
          body?.stableSlug !== undefined &&
          requestedStableSlug === null
        )
      ) {
      return NextResponse.json(
        {
          ok: false,
          message: "保存データが正しくありません。",
        },
        { status: 400 },
      );
    }

    const { data: currentData, error: currentError } =
      await supabaseAdmin
        .from("parari_books")
      .select(
        "id,owner,title,content,is_deleted,stable_slug,revision",
      )
      .eq("id", workId)
        .maybeSingle();

    if (currentError) {
      console.error(
        "[api/works/update] current work load failed:",
        currentError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "現在の作品情報を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    const currentWork = currentData as CurrentWorkRow | null;
      
      const isOwner = currentWork.owner === user.id;

      let isEditor = false;

      if (!isOwner) {
        const {
          data: collaborator,
          error: collaboratorError,
        } = await supabaseAdmin
          .from("parari_work_collaborators")
          .select("role")
          .eq("work_id", workId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (collaboratorError) {
          console.error(
            "[api/works/update] collaborator check failed:",
            collaboratorError,
          );

          return NextResponse.json(
            {
              ok: false,
              message: "共同編集権限を確認できませんでした。",
            },
            { status: 500 },
          );
        }

        isEditor = collaborator?.role === "editor";
      }

      if (!isOwner && !isEditor) {
        return NextResponse.json(
          {
            ok: false,
            code: "EDIT_PERMISSION_REQUIRED",
            message: "この作品を編集する権限がありません。",
          },
          { status: 403 },
        );
      }

      const ownerUserId = currentWork.owner;

      if (currentWork.revision !== expectedRevision) {
        return NextResponse.json(
          {
            ok: false,
            code: "REVISION_CONFLICT",
            currentRevision: currentWork.revision,
            message:
              "この作品は別の共同編集者によって更新されています。",
          },
          { status: 409 },
        );
      }

    if (!currentWork || currentWork.is_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message: "保存対象の作品が見つかりませんでした。",
        },
        { status: 404 },
      );
    }

    const nextIsWeb = isWebContent(content);

    const nextStableSlug =
      nextIsWeb && requestedStableSlug !== undefined
        ? requestedStableSlug
        : currentWork.stable_slug;

    if (nextIsWeb && !nextStableSlug) {
      return NextResponse.json(
        {
          ok: false,
          code: "WEB_SLUG_REQUIRED",
          message:
            "WEBサイトのslugを入力してください。",
        },
        { status: 400 },
      );
    }

    if (nextIsWeb && nextStableSlug) {
      const {
        data: duplicateWork,
        error: duplicateError,
      } = await supabaseAdmin
        .from("parari_books")
        .select("id")
        .eq("owner", ownerUserId)
        .eq("stable_slug", nextStableSlug)
        .neq("id", workId)
        .or(
          "is_deleted.is.null,is_deleted.eq.false",
        )
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (duplicateError) {
        console.error(
          "[api/works/update] stable slug duplicate check failed:",
          duplicateError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "サイトURLの重複を確認できませんでした。",
          },
          { status: 500 },
        );
      }

      if (duplicateWork) {
        return NextResponse.json(
          {
            ok: false,
            code: "WEB_SLUG_ALREADY_USED",
            message:
              "このサイトURLはすでに使用されています。",
          },
          { status: 409 },
        );
      }
    }

      const isMonitor = await getIsMonitorUser(ownerUserId);
      const billing = await getUserBillingByUserId(ownerUserId);
    const effectivePlan = getEffectivePlan(billing);
    const limits = getPlanLimits(effectivePlan);

    // ----------------------------------------------------
    // ページ数制限
    //
    // 既存作品がすでに上限を超えている場合でも、
    // ページ数を増やさない修正やページ削除は許可する。
    // ----------------------------------------------------

    const currentPageCount = countPagePanels(currentWork.content);
    const nextPageCount = countPagePanels(content);
    const pageLimit = isMonitor ? null : limits.pageLimitPerWork;

    if (
      pageLimit !== null &&
      nextPageCount > pageLimit &&
      nextPageCount > currentPageCount
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "PAGE_LIMIT_REACHED",
          plan: effectivePlan,
          currentPageCount,
          nextPageCount,
          limit: pageLimit,
          message:
            effectivePlan === "free"
              ? "Freeプランでは、1作品につき10ページまで作成できます。ページを追加するにはPlusをご利用ください。"
              : "Plusプランでは、1作品につき100ページまで作成できます。",
        },
        { status: 403 },
      );
    }

    const updatedAt = new Date().toISOString();

      const updatePayload: {
        title: string;
        content: string;
        updated_at: string;
        updated_by: string;
        stable_slug?: string | null;
      } = {
        title,
        content,
        updated_at: updatedAt,
        updated_by: user.id,
      };

    if (nextIsWeb) {
      updatePayload.stable_slug =
        nextStableSlug;
    }

      const {
        data: updatedWork,
        error: updateError,
      } = await supabaseAdmin
        .from("parari_books")
        .update(updatePayload)
        .eq("id", workId)
        .eq("owner", ownerUserId)
        .eq("revision", expectedRevision)
        .select("revision,updated_at,updated_by")
        .maybeSingle();;

    if (updateError) {
      console.error(
        "[api/works/update] update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: `保存に失敗しました: ${updateError.message}`,
        },
        { status: 500 },
      );
    }

      if (!updatedWork) {
        return NextResponse.json(
          {
            ok: false,
            code: "REVISION_CONFLICT",
            message:
              "この作品は別の共同編集者によって更新されています。",
          },
          { status: 409 },
        );
      }
      
      return NextResponse.json({
        ok: true,
        id: workId,
        plan: effectivePlan,
        isMonitor,
        
        pageCount: nextPageCount,
        pageLimit,
        
        updatedAt: updatedWork.updated_at ?? updatedAt,
        revision: updatedWork.revision,
        updatedBy: updatedWork.updated_by,
        stableSlug:
          nextIsWeb
            ? nextStableSlug
            : currentWork.stable_slug,
      });
  } catch (error) {
    console.error(
      "[api/works/update] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "作品保存処理で予期しないエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
