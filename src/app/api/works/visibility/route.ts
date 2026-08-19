// src/app/api/works/visibility/route.ts
// 2026-08-19 JST
//
// PARARI作品の公開設定変更API。
// Owner本人だけが private / unlisted / public を変更できる。
// 本文・revision・updated_at には触れない。
// 初回public日時 published_at はDBトリガーで自動記録する。

import { NextRequest, NextResponse } from "next/server";

import {
  getEffectivePlan,
  getPlanLimits,
  isAtOrOverLimit,
} from "@/lib/billing/plan";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";

type Visibility = "private" | "unlisted" | "public";

type UpdateVisibilityBody = {
  workId?: unknown;
  visibility?: unknown;
};

type CurrentWorkRow = {
  id: string;
  owner: string;
  visibility: string | null;
  is_public: boolean | null;
  is_deleted: boolean | null;
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
      "[api/works/visibility] monitor profile load failed:",
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

function normalizeVisibility(value: unknown): Visibility | null {
  if (
    value === "private" ||
    value === "unlisted" ||
    value === "public"
  ) {
    return value;
  }

  return null;
}

function isPublicWork(work: {
  visibility?: string | null;
  is_public?: boolean | null;
}): boolean {
  return work.visibility === "public" || work.is_public === true;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "公開設定を変更するにはログインが必要です。",
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
      | UpdateVisibilityBody
      | null;

    const workId = normalizeWorkId(body?.workId);
    const visibility = normalizeVisibility(body?.visibility);

    if (!workId || !visibility) {
      return NextResponse.json(
        {
          ok: false,
          message: "公開設定のデータが正しくありません。",
        },
        { status: 400 },
      );
    }

    const { data: currentData, error: currentError } =
      await supabaseAdmin
        .from("parari_books")
        .select("id,owner,visibility,is_public,is_deleted")
        .eq("id", workId)
        .maybeSingle();

    if (currentError) {
      console.error(
        "[api/works/visibility] current work load failed:",
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

    if (!currentWork || currentWork.is_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message: "対象の作品が見つかりませんでした。",
        },
        { status: 404 },
      );
    }

    if (currentWork.owner !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          code: "OWNER_REQUIRED",
          message: "公開設定を変更できるのは作品の所有者だけです。",
        },
        { status: 403 },
      );
    }

    const wasPublic = isPublicWork(currentWork);
    const willBePublic = visibility === "public";

    // ----------------------------------------------------
    // 新たにpublicへ変更するときだけ公開作品数制限を確認する。
    // すでにpublicの作品の再設定や、
    // private / unlistedへの変更では確認しない。
    // ----------------------------------------------------

    if (!wasPublic && willBePublic) {
      const isMonitor = await getIsMonitorUser(currentWork.owner);

      const billing = await getUserBillingByUserId(currentWork.owner);
      const effectivePlan = getEffectivePlan(billing);
      const limits = getPlanLimits(effectivePlan);

      const publishedWorkLimit = isMonitor
        ? null
        : limits.publishedWorkLimit;

      if (publishedWorkLimit !== null) {
        const { count: publishedCount, error: countError } =
          await supabaseAdmin
            .from("parari_books")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("owner", currentWork.owner)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .or("visibility.eq.public,is_public.eq.true");

        if (countError) {
          console.error(
            "[api/works/visibility] published count failed:",
            countError,
          );

          return NextResponse.json(
            {
              ok: false,
              message: "現在の公開作品数を確認できませんでした。",
            },
            { status: 500 },
          );
        }

        const currentPublishedCount = publishedCount ?? 0;

        if (
          isAtOrOverLimit(
            currentPublishedCount,
            publishedWorkLimit,
          )
        ) {
          return NextResponse.json(
            {
              ok: false,
              code: "PUBLISHED_WORK_LIMIT_REACHED",
              plan: effectivePlan,
              currentPublishedCount,
              limit: publishedWorkLimit,
              message:
                effectivePlan === "free"
                  ? "Freeプランでは3作品まで公開できます。別の作品を非公開にするか、Plusをご利用ください。"
                  : "現在のプランの公開作品数上限に達しています。",
            },
            { status: 403 },
          );
        }
      }
    }

    const { data: updatedWork, error: updateError } =
      await supabaseAdmin
        .from("parari_books")
        .update({
          visibility,
          is_public: willBePublic,
        })
        .eq("id", workId)
        .eq("owner", user.id)
        .select("visibility,is_public,published_at")
        .maybeSingle();

    if (updateError) {
      console.error(
        "[api/works/visibility] update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: `公開設定の変更に失敗しました: ${updateError.message}`,
        },
        { status: 500 },
      );
    }

    if (!updatedWork) {
      return NextResponse.json(
        {
          ok: false,
          message: "公開設定を変更できませんでした。",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: workId,
      visibility: updatedWork.visibility,
      isPublic: updatedWork.is_public,
      publishedAt: updatedWork.published_at,
    });
  } catch (error) {
    console.error(
      "[api/works/visibility] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "公開設定の変更中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
