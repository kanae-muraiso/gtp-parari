// src/app/api/commerce/products/route.ts
// 2026-10-05 00:10 JST
// PART: Commerce product management
// コメント:
// - 作品販売とORGANIZERの月謝商品を同じ商品テーブルで管理する
// - 作品SSOTは変更しない
// - recurring商品はSquare Subscription Planを作成する

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getUserPlanAccess } from "@/lib/billing/access";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  createSquareMonthlySubscriptionPlan,
} from "@/lib/square/api";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

export const runtime = "nodejs";

function bearerToken(request: NextRequest): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

function normalizeCurrency(value: unknown): string {
  const currency =
    typeof value === "string"
      ? value.trim().toUpperCase()
      : "JPY";

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : "JPY";
}

function toMinorUnits(
  amount: number,
  currency: string,
): number {
  const zeroDecimal =
    new Set(["JPY", "KRW", "VND"]);

  return Math.round(
    amount *
      (zeroDecimal.has(currency) ? 1 : 100),
  );
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "ログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("commerce_products")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    products: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "ログインが必要です。" },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, message: "ログイン情報を確認できませんでした。" },
        { status: 401 },
      );
    }

    const body =
      (await request.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

    const productId =
      typeof body?.productId === "string"
        ? body.productId.trim()
        : null;
    const workId =
      typeof body?.workId === "string" &&
      body.workId.trim()
        ? body.workId.trim()
        : null;
    const name =
      typeof body?.name === "string"
        ? body.name.trim()
        : "";
    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : null;
    const amount = Number(body?.amount);
    const currency =
      normalizeCurrency(body?.currency);
    const billingInterval =
      body?.billingInterval === "monthly"
        ? "monthly"
        : "one_time";
    const active =
      body?.active === false ? false : true;
    const productType =
      billingInterval === "monthly"
        ? "recurring"
        : workId
          ? "work"
          : "service";

    if (
      !name ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "商品名と正しい金額を入力してください。",
        },
        { status: 400 },
      );
    }

    const { entitlements } =
      await getUserPlanAccess(user.id);

    if (!entitlements.canUseIntegratedSales) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のプランでは販売機能を利用できません。",
        },
        { status: 403 },
      );
    }

    if (
      billingInterval === "monthly" &&
      !entitlements.canUseRecurringSales
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "ORGANIZER_REQUIRED",
          message:
            "月謝・定期サービスはOrganizerから利用できます。",
        },
        { status: 403 },
      );
    }

    if (workId) {
      const { data: work, error: workError } =
        await supabaseAdmin
          .from("parari_books")
          .select("id,owner,is_deleted")
          .eq("id", workId)
          .maybeSingle();

      if (
        workError ||
        !work ||
        work.owner !== user.id ||
        work.is_deleted === true
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "販売対象の作品を確認できませんでした。",
          },
          { status: 403 },
        );
      }
    }

    let existing:
      | {
          id: string;
          owner_user_id: string;
          name: string;
          amount: number | string;
          currency: string;
          billing_interval: string;
          square_plan_id: string | null;
          square_plan_variation_id: string | null;
        }
      | null = null;

    if (productId) {
      const { data, error } = await supabaseAdmin
        .from("commerce_products")
        .select(
          "id,owner_user_id,name,amount,currency,billing_interval,square_plan_id,square_plan_variation_id",
        )
        .eq("id", productId)
        .maybeSingle();

      if (
        error ||
        !data ||
        data.owner_user_id !== user.id
      ) {
        return NextResponse.json(
          { ok: false, message: "商品を更新できません。" },
          { status: 403 },
        );
      }

      existing = data;
    }

    let squarePlanId =
      existing?.square_plan_id ?? null;
    let squarePlanVariationId =
      existing?.square_plan_variation_id ?? null;

    const recurringDefinitionChanged =
      billingInterval === "monthly" &&
      (
        !existing ||
        existing.billing_interval !== "monthly" ||
        existing.name !== name ||
        Number(existing.amount) !== amount ||
        existing.currency !== currency ||
        !squarePlanId ||
        !squarePlanVariationId
      );

    if (recurringDefinitionChanged) {
      const connection =
        await getUsableSquareConnection(user.id);
      const amountMinor =
        toMinorUnits(amount, currency);

      const plan =
        await createSquareMonthlySubscriptionPlan({
          accessToken: connection.accessToken,
          idempotencyKey: randomUUID(),
          name,
          amountMinor,
          currency,
        });

      squarePlanId = plan.planId;
      squarePlanVariationId =
        plan.variationId;
    }

    const payload = {
      owner_user_id: user.id,
      product_type: productType,
      work_id: workId,
      name,
      description,
      amount,
      currency,
      billing_interval: billingInterval,
      active,
      square_plan_id:
        billingInterval === "monthly"
          ? squarePlanId
          : null,
      square_plan_variation_id:
        billingInterval === "monthly"
          ? squarePlanVariationId
          : null,
      updated_at: new Date().toISOString(),
    };

    const query = productId
      ? supabaseAdmin
          .from("commerce_products")
          .update(payload)
          .eq("id", productId)
          .eq("owner_user_id", user.id)
      : supabaseAdmin
          .from("commerce_products")
          .insert(payload);

    const { data: product, error } =
      await query
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (error) {
    console.error("[commerce/products]", error);

    const code =
      error instanceof Error
        ? error.message
        : "";

    return NextResponse.json(
      {
        ok: false,
        message:
          code === "SQUARE_NOT_CONNECTED" ||
          code === "SQUARE_RECONNECT_REQUIRED"
            ? "定期商品を作成するにはSquare接続が必要です。"
            : "商品を保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
