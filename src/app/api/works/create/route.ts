// src/app/api/works/create/route.ts
// 2026-07-11 JST
//
// PARARI作品の新規作成API。
// ユーザーの有効プランと現在作品数をサーバー側で確認し、
// Free / Plusの作品作成上限を超えるinsertを拒否する。

import { NextRequest, NextResponse } from "next/server";
import {
  getEffectivePlan,
  getPlanLimits,
  isAtOrOverLimit,
} from "@/lib/billing/plan";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";

type CreateWorkBody = {
  stableSlug?: unknown;
  template?: {
    kind?: unknown;
    initialTitle?: unknown;
    ssot?: unknown;
  };
};

type MonitorProfileRow = {
  is_monitor: boolean | null;
};

type UsernameProfileRow = {
  username: string | null;
};

async function getProfileUsername(
  userId: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[api/works/create] username profile load failed:",
      error,
    );
    throw new Error("Failed to load profile username");
  }

  return String(
    (data as UsernameProfileRow | null)?.username ?? "",
  ).trim();
}

async function getIsMonitorUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_monitor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[api/works/create] monitor profile load failed:",
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

function normalizeKind(value: unknown): "page" | "book" | "web" | null {
  if (value === "page" || value === "book" || value === "web") {
    return value;
  }

  return null;
}

function normalizeStableSlug(value: unknown): string | null {
  const slug = String(value ?? "").trim();

  if (!slug) {
    return null;
  }

  if (slug.length > 160) {
    return null;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return null;
  }

  return slug;
}

const RESERVED_WEB_SLUGS = new Set([
  "admin",
  "api",
  "billing",
  "dev",
  "editor",
  "editor-v2",
  "login",
  "my",
  "new",
  "p",
  "profile",
  "settings",
  "signup",
  "tools",
  "works",
]);

function getWebSlugError(
  value: string,
): string | null {
  if (value.length < 3 || value.length > 50) {
    return "URL名は3〜50文字で入力してください。";
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  ) {
    return "URL名には半角英小文字・数字・ハイフンのみ使用できます。";
  }

  if (RESERVED_WEB_SLUGS.has(value)) {
    return "このURL名は予約されているため使用できません。";
  }

  return null;
}

function normalizeTitle(value: unknown): string {
  const title = String(value ?? "").trim();

  if (!title) {
    return "Untitled";
  }

  return title.slice(0, 300);
}

function isWebWorkContent(
  value: string | null,
): boolean {
  return /^\s*\[(WEB|WEBINFO)\b/i.test(
    String(value ?? ""),
  );
}

function normalizeSsot(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  // 異常に大きなリクエストを防ぐため、現段階では5MBを上限にする。
  if (value.length > 5_000_000) {
    return null;
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品を作成するにはログインが必要です。",
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
      | CreateWorkBody
      | null;

    const kind = normalizeKind(body?.template?.kind);
    const stableSlug = normalizeStableSlug(body?.stableSlug);
    const initialTitle = normalizeTitle(body?.template?.initialTitle);
    const ssot = normalizeSsot(body?.template?.ssot);

    if (!kind || !stableSlug || ssot === null) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品作成データが正しくありません。",
        },
        { status: 400 },
      );
    }

    const isMonitor = await getIsMonitorUser(user.id);
    const billing = await getUserBillingByUserId(user.id);
    const effectivePlan = getEffectivePlan(billing);
    const limits = getPlanLimits(effectivePlan);
    const workLimit = isMonitor ? null : limits.workLimit;

    if (kind === "web") {
      const username = await getProfileUsername(
        user.id,
      );

      if (!username) {
        return NextResponse.json(
          {
            ok: false,
            code: "USERNAME_REQUIRED_FOR_WEB",
            message:
              "WEBサイトを作成するには、先にユーザー名を設定してください。",
          },
          { status: 403 },
        );
      }

      const webLimit = isMonitor
        ? null
        : effectivePlan === "free"
          ? 1
          : 3;

      const {
        data: activeWorks,
        error: activeWorksError,
      } = await supabaseAdmin
        .from("parari_books")
        .select("id, content")
        .eq("owner", user.id)
        .or("is_deleted.is.null,is_deleted.eq.false");

      if (activeWorksError) {
        console.error(
          "[api/works/create] web count failed:",
          activeWorksError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "現在のWEBサイト数を確認できませんでした。",
          },
          { status: 500 },
        );
      }

      const currentWebCount = (
        activeWorks ?? []
      ).filter((work) =>
        isWebWorkContent(work.content),
      ).length;

      if (
        webLimit !== null &&
        currentWebCount >= webLimit
      ) {
        return NextResponse.json(
          {
            ok: false,
            code: "WEB_LIMIT_REACHED",
            plan: effectivePlan,
            currentCount: currentWebCount,
            limit: webLimit,
            message:
              effectivePlan === "free"
                ? "FreeプランではWEBサイトを1個まで作成できます。複数のWEBサイトを作成するにはPlusをご利用ください。"
                : "PlusプランではWEBサイトを3個まで作成できます。",
          },
          { status: 403 },
        );
      }

      const webSlugError =
        getWebSlugError(stableSlug);

      if (webSlugError) {
        return NextResponse.json(
          {
            ok: false,
            code: "INVALID_WEB_SLUG",
            message: webSlugError,
          },
          { status: 400 },
        );
      }

      const {
        data: existingSlugRows,
        error: existingSlugError,
      } = await supabaseAdmin
        .from("parari_books")
        .select("id")
        .eq("owner", user.id)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .or(
          [
            `stable_slug.eq.${stableSlug}`,
            `slug.eq.${stableSlug}`,
            `custom_slug.eq.${stableSlug}`,
          ].join(","),
        )
        .limit(1);

      if (existingSlugError) {
        console.error(
          "[api/works/create] web slug check failed:",
          existingSlugError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "URLが利用可能か確認できませんでした。",
          },
          { status: 500 },
        );
      }

      if (
        Array.isArray(existingSlugRows) &&
        existingSlugRows.length > 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            code: "WEB_SLUG_ALREADY_USED",
            message:
              "このURL名はすでに使用されています。別のURL名を入力してください。",
          },
          { status: 409 },
        );
      }
    }

    const { count: workCount, error: countError } = await supabaseAdmin
      .from("parari_books")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("owner", user.id)
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (countError) {
      console.error("[api/works/create] count failed:", countError);

      return NextResponse.json(
        {
          ok: false,
          message: "現在の作品数を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    const currentWorkCount = workCount ?? 0;

    if (isAtOrOverLimit(currentWorkCount, workLimit)) {
      return NextResponse.json(
        {
          ok: false,
          code: "WORK_LIMIT_REACHED",
          plan: effectivePlan,
          currentCount: currentWorkCount,
          limit: workLimit,
          message:
            effectivePlan === "free"
              ? "Freeプランでは作品を10作品まで作成できます。続けて作成するにはPlusをご利用ください。"
              : "Plusプランの作品作成上限に達しています。",
        },
        { status: 403 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("parari_books")
      .insert({
        owner: user.id,
        title: initialTitle,
        stable_slug: stableSlug,
        content: ssot,
        visibility: "unlisted",
        is_public: false,
        is_deleted: false,
        render_mode: kind === "book" ? "page" : "scroll",
        physical_pagination: false,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[api/works/create] insert failed:", error);

      return NextResponse.json(
        {
          ok: false,
          message: `作品作成に失敗しました: ${
            error?.message ?? "unknown error"
          }`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      plan: effectivePlan,
      isMonitor,
      currentCount: currentWorkCount + 1,
      limit: workLimit,
    });
  } catch (error) {
    console.error("[api/works/create] unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "作品作成処理で予期しないエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
