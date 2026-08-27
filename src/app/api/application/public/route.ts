// apps/tools/parari/src/app/api/application/public/route.ts
// src/app/api/application/public/route.ts
// 2026-08-15 JST
//
// APPLICATION v2 public API
//
// - 新 applications テーブルを読む
// - application_entries から現在の申込数を数える
// - APPLICATIONに設定された定員とプラン上限を反映する
// - FORMそのものは /api/form/public が担当する

import { NextResponse } from "next/server";

import {
  getEffectivePlan,
  getPlanLimits,
  type BillingLike,
} from "@/lib/billing/plan";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";


type ApplicationField = {
  id?: string;
  key?: string | null;
  label?: string;
  type?: string;
  value?: unknown;
  required?: boolean;
};


type ApplicationDefinition = {
  mode?: "lite" | "builder";
  fields?: ApplicationField[];
  agreement?: string;
  actionLabel?: string;
};


type ApplicationRow = {
  id: string;
  owner_user_id: string;

  application_type:
    | "EVENT"
    | "RECRUITMENT"
    | "SCHOOL"
    | "CONTEST"
    | "VOLUNTEER"
    | "OTHER";

  title: string;
  description: string | null;

  definition:
    | ApplicationDefinition
    | null;

  form_id: string | null;

  acceptance_mode:
    | "instant"
    | "approval";

  payment_method:
    | "none"
    | "on_site"
    | "bank_transfer"
    | "payment_link";

  payment_amount:
    | number
    | null;

  payment_currency: string;

  status:
    | "draft"
    | "open"
    | "closed";

  version: number;

  created_at: string;
  updated_at: string;
};


type OwnerBillingRow = {
  plan: string | null;
  billing_status: string | null;
};


async function loadOwnerBilling(
  ownerUserId: string,
): Promise<BillingLike | null> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("user_billing")
    .select(
      "plan, billing_status",
    )
    .eq(
      "user_id",
      ownerUserId,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "load application owner billing failed:",
      error,
    );

    return null;
  }

  const row =
    data as OwnerBillingRow | null;

  if (!row) {
    return null;
  }

  return {
    plan: row.plan,
    billing_status:
      row.billing_status,
  };
}


function getFields(
  definition:
    | ApplicationDefinition
    | null
    | undefined,
): ApplicationField[] {
  if (
    !definition ||
    !Array.isArray(
      definition.fields,
    )
  ) {
    return [];
  }

  return definition.fields;
}


function getCapacity(
  definition:
    | ApplicationDefinition
    | null
    | undefined,
): number | null {
  const field =
    getFields(definition).find(
      (item) =>
        item.key ===
        "capacity",
    );

  if (!field) {
    return null;
  }

  const value =
    Number(field.value);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return Math.floor(value);
}


function resolveEffectiveLimit(
  capacityLimit: number | null,
  planLimit: number | null,
): number | null {
  if (
    capacityLimit === null &&
    planLimit === null
  ) {
    return null;
  }

  if (
    capacityLimit === null
  ) {
    return planLimit;
  }

  if (
    planLimit === null
  ) {
    return capacityLimit;
  }

  return Math.min(
    capacityLimit,
    planLimit,
  );
}


export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const applicationId =
      String(
        url.searchParams.get(
          "applicationId",
        ) ?? "",
      ).trim();

    if (!applicationId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "applicationId がありません。",
        },
        {
          status: 400,
        },
      );
    }


    // ========================================================
    // APPLICATION本体
    // ========================================================

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("applications")
      .select(
        `
          id,
          owner_user_id,
          application_type,
          title,
          description,
          definition,
          form_id,
          acceptance_mode,
          payment_method,
          payment_amount,
          payment_currency,
          status,
          version,
          created_at,
          updated_at
        `,
      )
      .eq(
        "id",
        applicationId,
      )
      .maybeSingle();

    if (
      error ||
      !data
    ) {
      console.error(
        "load public application failed:",
        {
          applicationId,
          error,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "募集情報を取得できませんでした。",
        },
        {
          status: 404,
        },
      );
    }

    const application =
      data as ApplicationRow;


    // ========================================================
    // 現在の有効申込数
    //
    // rejected / withdrawn / cancelled は数えない。
    // ========================================================

    const {
      count,
      error: countError,
    } = await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq(
        "application_id",
        application.id,
      )
      .in(
        "status",
        [
          "submitted",
          "confirmed",
        ],
      );

    if (countError) {
      console.error(
        "count application entries failed:",
        countError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "申込状況を取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    const entryCount =
      count ?? 0;


    // ========================================================
    // プランによる参加人数上限
    // ========================================================

    const ownerBilling =
      await loadOwnerBilling(
        application.owner_user_id,
      );

    const effectivePlan =
      getEffectivePlan(
        ownerBilling,
      );

    const limits =
      getPlanLimits(
        effectivePlan,
      );

    const planParticipantLimit =
      limits.applicationParticipantLimit;


    // ========================================================
    // APPLICATION自身の定員
    //
    // definition.fields の
    // key="capacity" を標準定員として読む。
    // ========================================================

    const capacityLimit =
      getCapacity(
        application.definition,
      );

    const effectiveParticipantLimit =
      resolveEffectiveLimit(
        capacityLimit,
        planParticipantLimit,
      );

    const remainingSlots =
      effectiveParticipantLimit ===
      null
        ? null
        : Math.max(
            effectiveParticipantLimit -
              entryCount,
            0,
          );

    const isPlanLimited =
      planParticipantLimit !==
        null &&
      (
        capacityLimit === null ||
        planParticipantLimit <
          capacityLimit
      );


    // ========================================================
    // Public response
    // ========================================================

    return NextResponse.json({
      ok: true,

      application: {
        id:
          application.id,

        application_type:
          application.application_type,

        title:
          application.title,

        description:
          application.description,

        definition:
          application.definition ?? {
            fields: [],
          },

        form_id:
          application.form_id,

        acceptance_mode:
          application.acceptance_mode,

        payment_method:
          application.payment_method,

        payment_amount:
          application.payment_amount,

        payment_currency:
          application.payment_currency,

        status:
          application.status,

        version:
          application.version,

        entry_count:
          entryCount,

        capacity_limit:
          capacityLimit,

        plan_participant_limit:
          planParticipantLimit,

        effective_participant_limit:
          effectiveParticipantLimit,

        remaining_slots:
          remainingSlots,

        is_plan_limited:
          isPlanLimited,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/application/public failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "募集情報を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}
