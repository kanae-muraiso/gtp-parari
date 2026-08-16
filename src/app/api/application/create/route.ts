// apps/tools/parari/src/app/api/application/create/route.ts
// 2026-05-21 16:05 JST

/**
 * PART: application create API
 * コメント:
 * - APPLICATION作成をサーバー側APIに寄せる
 * - FreeユーザーはAPPLICATION作成1つまで
 * - Plus / Pro は作成数制限なし
 * - UIだけでなくAPI側で最終防衛する
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getEffectivePlan,
  getPlanLimits,
  isAtOrOverLimit,
  type BillingLike,
} from "@/lib/billing/plan";

type OwnerBillingRow = {
  plan: string | null;
  billing_status: string | null;
};

// apps/tools/parari/src/app/api/application/create/route.ts
// 2026-05-30 JST

/**
 * PART: CreateApplicationBody
 * コメント:
 * - AP-PLACE-1として location（開催場所）を追加
 */
type CreateApplicationBody = {
  event_name?: unknown;
  location?: unknown;
  event_date?: unknown;
  deadline?: unknown;
  capacity?: unknown;
  button_label?: unknown;
  status?: unknown;
};

function makeAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function loadOwnerBilling(
  adminClient: any,
  ownerUserId: string,
): Promise<BillingLike | null> {
  const { data, error } = await (adminClient as any)
    .from("user_billing")
    .select("plan, billing_status")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    console.error("load owner billing failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      ownerUserId,
    });

    return null;
  }

  const row = data as OwnerBillingRow | null;

  if (!row) return null;

  return {
    plan: row.plan,
    billing_status: row.billing_status,
  };
}

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeCapacity(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;
  if (numberValue <= 0) return null;

  return Math.floor(numberValue);
}

function normalizeStatus(value: unknown): "draft" | "open" | "closed" {
  if (value === "draft" || value === "open" || value === "closed") {
    return value;
  }

  return "open";
}

export async function POST(request: Request) {
  try {
    const adminClient = makeAdminClient();

    if (!adminClient) {
      return NextResponse.json(
        { ok: false, message: "Supabase 管理接続が設定されていません" },
        { status: 500 },
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "ログインしてください" },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user?.id) {
      return NextResponse.json(
        { ok: false, message: "ログインしてください" },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as CreateApplicationBody;

    const eventName = String(body.event_name ?? "").trim();

    if (!eventName) {
      return NextResponse.json(
        { ok: false, message: "イベント名を入力してください" },
        { status: 400 },
      );
    }

    /**
     * PART: application create count limit
     * コメント:
     * - Free は APPLICATION 1つまで
     * - Plus / Pro は null = 制限なし
     */
    const ownerBilling = await loadOwnerBilling(adminClient, user.id);
    const effectivePlan = getEffectivePlan(ownerBilling);
    const planLimits = getPlanLimits(effectivePlan);
    const applicationPanelLimit = planLimits.applicationPanelLimit;

    const { count, error: countError } = await (adminClient as any)
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id);

    if (countError) {
      console.error("count applications failed:", {
        message: countError.message,
        details: countError.details,
        hint: countError.hint,
        code: countError.code,
        userId: user.id,
      });

      return NextResponse.json(
        { ok: false, message: "APPLICATION の作成確認に失敗しました" },
        { status: 500 },
      );
    }

    const currentApplicationCount = count ?? 0;

    if (isAtOrOverLimit(currentApplicationCount, applicationPanelLimit)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            effectivePlan === "free"
              ? "FreeプランではAPPLICATIONは1つまで作成できます。"
              : "APPLICATIONの作成上限に達しました。",
          effectivePlan,
          limit: applicationPanelLimit,
          currentCount: currentApplicationCount,
        },
        { status: 400 },
      );
    }

      // apps/tools/parari/src/app/api/application/create/route.ts
      // 2026-05-30 JST

      /**
       * PART: create application payload
       * コメント:
       * - location を applications.location に保存する
       */
          const payload = {
            owner_user_id: user.id,
            event_name: eventName,
            location: normalizeNullableText(body.location),
            event_date: normalizeNullableText(body.event_date),
            deadline: normalizeNullableText(body.deadline),
            capacity: normalizeCapacity(body.capacity),
            button_label:
              String(body.button_label ?? "参加登録する").trim() || "参加登録する",
            status: normalizeStatus(body.status),
          };

    const { data, error } = await (adminClient as any)
      .from("applications")
      .insert(payload)
      .select("id,event_name,location,event_date,deadline,capacity,button_label,status")
      .single();

    if (error || !data?.id) {
      console.error("create application failed:", {
        message: error?.message ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
        code: error?.code ?? null,
        userId: user.id,
      });

      return NextResponse.json(
        { ok: false, message: "APPLICATION の作成に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      application: data,
    });
  } catch (error) {
    console.error("POST /api/application/create failed:", error);

    return NextResponse.json(
      { ok: false, message: "APPLICATION の作成に失敗しました" },
      { status: 500 },
    );
  }
}
