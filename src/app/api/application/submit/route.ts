// src/app/api/application/submit/route.ts
// 2026-08-15 JST
//
// APPLICATION v2 submit API
//
// - APPLICATIONへの申込を application_entries に保存する
// - APPLICATION応募者はPARARIログイン必須
// - FORMありの場合は form_submission_id を検証する
// - FORM回答そのものはAPPLICATIONへコピーしない
// - instant  -> confirmed
// - approval -> submitted
// - APPLICATION条件をsnapshotとして保存する

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

import {
  getEffectivePlan,
  getPlanLimits,
  isAtOrOverLimit,
} from "@/lib/billing/plan";

import {
  getUserBillingByUserId,
} from "@/lib/billing/supabaseBilling";


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


type ApplicationDefinition = {
  fields?: Array<{
    key?: string | null;
    value?: unknown;
  }>;

  agreement?: string;
  actionLabel?: string;
};


type ApplicationRow = {
  id: string;
  owner_user_id: string;

  application_type: string;

  title: string;
  description: string | null;

  definition:
    | ApplicationDefinition
    | null;

  form_id:
    | string
    | null;

  acceptance_mode:
    | "instant"
    | "approval";

  status:
    | "draft"
    | "open"
    | "closed";

  version: number;
};


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}


function getSemanticValue(
  definition:
    | ApplicationDefinition
    | null,
  key: string,
): string | null {
  const fields =
    Array.isArray(
      definition?.fields,
    )
      ? definition.fields
      : [];

  const field =
    fields.find(
      (item) =>
        item.key === key,
    );

  if (!field) {
    return null;
  }

  const value =
    String(
      field.value ?? "",
    ).trim();

  return value || null;
}


function getCapacity(
  definition:
    | ApplicationDefinition
    | null,
): number | null {
  const value =
    getSemanticValue(
      definition,
      "capacity",
    );

  if (!value) {
    return null;
  }

  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue,
    ) ||
    numberValue <= 0
  ) {
    return null;
  }

  return Math.floor(
    numberValue,
  );
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


function deadlineHasPassed(
  definition:
    | ApplicationDefinition
    | null,
): boolean {
  const deadline =
    getSemanticValue(
      definition,
      "deadline",
    );

  if (!deadline) {
    return false;
  }

  const timestamp =
    new Date(
      deadline,
    ).getTime();

  if (
    Number.isNaN(timestamp)
  ) {
    return false;
  }

  return (
    timestamp <
    Date.now()
  );
}


export async function POST(
  request: NextRequest,
) {
  try {
    // ======================================================
    // 認証
    // ======================================================

    const token =
      getBearerToken(
        request,
      );

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "お申し込みにはログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログイン情報を確認できませんでした。",
        },
        {
          status: 401,
        },
      );
    }


    // ======================================================
    // Request
    // ======================================================

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            applicationId?: unknown;
            formSubmissionId?: unknown;
          }
        | null;

    const applicationId =
      typeof body?.applicationId ===
      "string"
        ? body.applicationId.trim()
        : "";

    const formSubmissionId =
      typeof body?.formSubmissionId ===
      "string"
        ? body.formSubmissionId.trim()
        : "";

    if (
      !UUID_RE.test(
        applicationId,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "APPLICATIONが指定されていません。",
        },
        {
          status: 400,
        },
      );
    }


    // ======================================================
    // APPLICATION本体
    // ======================================================

    const {
      data: applicationData,
      error: applicationError,
    } =
      await supabaseAdmin
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
            status,
            version
          `,
        )
        .eq(
          "id",
          applicationId,
        )
        .maybeSingle();

    if (
      applicationError ||
      !applicationData
    ) {
      console.error(
        "application submit load failed:",
        applicationError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "募集情報を確認できませんでした。",
        },
        {
          status:
            applicationError
              ? 500
              : 404,
        },
      );
    }

    const application =
      applicationData as ApplicationRow;


    // ======================================================
    // 受付状態
    // ======================================================

    if (
      application.status !==
      "open"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "現在、この募集は受付していません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      application.owner_user_id ===
      user.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "主催者本人は申し込めません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      deadlineHasPassed(
        application.definition,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "申込期限を過ぎています。",
        },
        {
          status: 400,
        },
      );
    }


    // ======================================================
    // 二重申込防止
    // ======================================================

    const {
      data: existingEntry,
      error: existingError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          "id, status",
        )
        .eq(
          "application_id",
          application.id,
        )
        .eq(
          "user_id",
          user.id,
        )
        .in(
          "status",
          [
            "submitted",
            "confirmed",
          ],
        )
        .limit(1)
        .maybeSingle();

    if (existingError) {
      console.error(
        "application duplicate check failed:",
        existingError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "申込状況を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    if (existingEntry) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "すでにお申し込み済みです。",
        },
        {
          status: 409,
        },
      );
    }


    // ======================================================
    // FORM確認
    // ======================================================

    let validatedFormSubmissionId:
      string | null = null;

    if (
      application.form_id
    ) {
      if (
        !UUID_RE.test(
          formSubmissionId,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "申込FORMへの回答が必要です。",
          },
          {
            status: 400,
          },
        );
      }

      const {
        data: formSubmission,
        error:
          formSubmissionError,
      } =
        await supabaseAdmin
          .from(
            "form_submissions",
          )
          .select(
            `
              id,
              form_id,
              user_id
            `,
          )
          .eq(
            "id",
            formSubmissionId,
          )
          .maybeSingle();

      if (
        formSubmissionError ||
        !formSubmission
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "申込FORMの回答を確認できませんでした。",
          },
          {
            status: 400,
          },
        );
      }

      if (
        formSubmission.form_id !==
        application.form_id
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "このAPPLICATIONのFORM回答ではありません。",
          },
          {
            status: 400,
          },
        );
      }

      if (
        formSubmission.user_id !==
        user.id
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "FORM回答のユーザー情報が一致しません。",
          },
          {
            status: 403,
          },
        );
      }

      validatedFormSubmissionId =
        formSubmission.id;
    }


    // ======================================================
    // 定員・プラン上限
    // ======================================================

    const ownerBilling =
      await getUserBillingByUserId(
        application.owner_user_id,
      );

    const effectivePlan =
      getEffectivePlan(
        ownerBilling,
      );

    const planLimits =
      getPlanLimits(
        effectivePlan,
      );

    const planParticipantLimit =
      planLimits.applicationParticipantLimit;

    const capacityLimit =
      getCapacity(
        application.definition,
      );

    const effectiveLimit =
      resolveEffectiveLimit(
        capacityLimit,
        planParticipantLimit,
      );

    const {
      count,
      error: countError,
    } =
      await supabaseAdmin
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
        "application entry count failed:",
        countError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "現在の申込数を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    if (
      isAtOrOverLimit(
        count ?? 0,
        effectiveLimit,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "受付可能人数に達しています。",
        },
        {
          status: 409,
        },
      );
    }


    // ======================================================
    // Snapshot
    // ======================================================

    const applicationSnapshot = {
      id:
        application.id,

      application_type:
        application.application_type,

      title:
        application.title,

      description:
        application.description,

      definition:
        application.definition,

      form_id:
        application.form_id,

      acceptance_mode:
        application.acceptance_mode,

      version:
        application.version,
    };


    // ======================================================
    // Entry作成
    // ======================================================

    const entryStatus =
      application.acceptance_mode ===
      "instant"
        ? "confirmed"
        : "submitted";

    const {
      data: entry,
      error: insertError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .insert({
          application_id:
            application.id,

          application_version:
            application.version,

          user_id:
            user.id,

          form_submission_id:
            validatedFormSubmissionId,

          status:
            entryStatus,

          application_snapshot:
            applicationSnapshot,
        })
        .select(
          `
            id,
            status,
            agreed_at,
            created_at
          `,
        )
        .single();

    if (insertError) {
      console.error(
        "application entry insert failed:",
        insertError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "お申し込みを登録できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (error) {
    console.error(
      "POST /api/application/submit failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "お申し込みを完了できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}
