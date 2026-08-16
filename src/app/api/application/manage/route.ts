// src/app/api/application/manage/route.ts
// 2026-08-15 JST
//
// APPLICATION v2 管理API
//
// GET   : 自分のAPPLICATION一覧
// POST  : 新規APPLICATION作成
// PATCH : 既存APPLICATION編集

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

const APPLICATION_TYPES = [
  "EVENT",
  "RECRUITMENT",
  "SCHOOL",
  "CONTEST",
  "VOLUNTEER",
  "OTHER",
] as const;

const ACCEPTANCE_MODES = [
  "instant",
  "approval",
] as const;

const PAYMENT_METHODS = [
  "none",
  "on_site",
  "bank_transfer",
  "payment_link",
] as const;


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログイン情報がありません。",
    };
  }

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    error ||
    !user
  ) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログイン情報を確認できませんでした。",
    };
  }

  return {
    ok: true as const,
    user,
  };
}

async function getApplicationAccess(
  userId: string,
) {
  try {
    const billing =
      await getUserBillingByUserId(
        userId,
      );

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("is_monitor")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(
        "application access profile check failed:",
        profileError,
      );

      return {
        ok: false as const,
        message:
          "利用権限を確認できませんでした。",
      };
    }

    const isMonitor =
      profile?.is_monitor === true;

    const effectivePlan =
      getEffectivePlan(billing);

    const planLimits =
      getPlanLimits(
        effectivePlan,
      );

    // モニターは契約プランに関係なく無制限
    const applicationLimit =
      isMonitor
        ? null
        : planLimits.applicationPanelLimit;

    return {
      ok: true as const,
      isMonitor,
      effectivePlan,
      applicationLimit,
    };
  } catch (error) {
    console.error(
      "application access check failed:",
      error,
    );

    return {
      ok: false as const,
      message:
        "利用権限を確認できませんでした。",
    };
  }
}

function isApplicationType(
  value: string,
): value is
  (typeof APPLICATION_TYPES)[number] {
  return APPLICATION_TYPES.includes(
    value as
      (typeof APPLICATION_TYPES)[number],
  );
}


function isAcceptanceMode(
  value: string,
): value is
  (typeof ACCEPTANCE_MODES)[number] {
  return ACCEPTANCE_MODES.includes(
    value as
      (typeof ACCEPTANCE_MODES)[number],
  );
}

function isPaymentMethod(
  value: string,
): value is
  (typeof PAYMENT_METHODS)[number] {
  return PAYMENT_METHODS.includes(
    value as
      (typeof PAYMENT_METHODS)[number],
  );
}

async function validateFormOwnership(
  formId: string | null,
  userId: string,
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    }
> {
  if (!formId) {
    return {
      ok: true,
    };
  }

  const {
    data: form,
    error,
  } = await supabaseAdmin
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq(
      "owner_user_id",
      userId,
    )
    .maybeSingle();

  if (
    error ||
    !form
  ) {
    return {
      ok: false,
      message:
        "指定されたFORMを使用できません。",
    };
  }

  return {
    ok: true,
  };
}


// ============================================================
// GET
// 自分のAPPLICATION一覧
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const {
    data: applications,
    error,
  } = await supabaseAdmin
    .from("applications")
    .select(
      `
        id,
        application_type,
        title,
        description,
        definition,
        form_id,
        acceptance_mode,
        payment_method,
        payment_amount,
        payment_currency,
        payment_url,
        payment_instructions,
        payment_confirmation_required,
        status,
        version,
        created_at,
        updated_at
      `,
    )
    .eq(
      "owner_user_id",
      auth.user.id,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "application list failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATION一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

    const access =
      await getApplicationAccess(
        auth.user.id,
      );

    if (access.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: access.message,
        },
        {
          status: 500,
        },
      );
    }

    const applicationCount =
      applications?.length ?? 0;

    return NextResponse.json({
      ok: true,

      applications:
        applications ?? [],

      access: {
        isMonitor:
          access.isMonitor,

        effectivePlan:
          access.effectivePlan,

        applicationLimit:
          access.applicationLimit,

        canCreateApplication:
          !isAtOrOverLimit(
            applicationCount,
            access.applicationLimit,
          ),
      },
    });
}


// ============================================================
// POST
// 新規APPLICATION作成
// ============================================================

export async function POST(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

    const access =
      await getApplicationAccess(
        auth.user.id,
      );

    if (access.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: access.message,
        },
        {
          status: 500,
        },
      );
    }

    const {
      count,
      error: countError,
    } = await supabaseAdmin
      .from("applications")
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      );

    if (countError) {
      console.error(
        "application count failed:",
        countError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "APPLICATION数を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    if (
      isAtOrOverLimit(
        count ?? 0,
        access.applicationLimit,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "FREEプランではAPPLICATIONは1つまで作成できます。",
        },
        {
          status: 403,
        },
      );
    }
    
  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        applicationType?: unknown;
        title?: unknown;
        description?: unknown;
        definition?: unknown;
        formId?: unknown;
        acceptanceMode?: unknown;

        paymentMethod?: unknown;
        paymentAmount?: unknown;
        paymentUrl?: unknown;
        paymentInstructions?: unknown;
        paymentConfirmationRequired?: unknown;
      }
    | null;
    
  const applicationType =
    typeof body?.applicationType ===
      "string"
      ? body.applicationType.trim()
      : "";

  const title =
    typeof body?.title === "string"
      ? body.title.trim()
      : "";

  const description =
    typeof body?.description ===
      "string"
      ? body.description.trim()
      : "";

  const formId =
    typeof body?.formId === "string" &&
    body.formId.trim()
      ? body.formId.trim()
      : null;

  const acceptanceMode =
    typeof body?.acceptanceMode ===
      "string"
      ? body.acceptanceMode.trim()
      : "instant";
    
    const paymentMethod =
      typeof body?.paymentMethod === "string"
        ? body.paymentMethod.trim()
        : "none";

    const paymentAmount =
      typeof body?.paymentAmount === "number"
        ? body.paymentAmount
        : typeof body?.paymentAmount === "string" &&
            body.paymentAmount.trim()
          ? Number(body.paymentAmount)
          : null;

    const paymentUrl =
      typeof body?.paymentUrl === "string"
        ? body.paymentUrl.trim()
        : "";

    const paymentInstructions =
      typeof body?.paymentInstructions === "string"
        ? body.paymentInstructions.trim()
        : "";

    const paymentConfirmationRequired =
      body?.paymentConfirmationRequired === true;
    
    const normalizedPaymentConfirmationRequired =
      (
        paymentMethod === "bank_transfer" ||
        paymentMethod === "payment_link"
      )
        ? paymentConfirmationRequired
        : false;
    
  if (
    !isApplicationType(
      applicationType,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONの種類が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "募集名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    title.length > 120
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "募集名は120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    description.length > 5000
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "募集案内は5000文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isAcceptanceMode(
      acceptanceMode,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "受付方法が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }
    
    if (
      !isPaymentMethod(
        paymentMethod,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "支払方法が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      paymentMethod !== "none" &&
      (
        paymentAmount === null ||
        !Number.isFinite(
          paymentAmount,
        ) ||
        paymentAmount <= 0
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "参加費を正しく入力してください。",
        },
        {
          status: 400,
        },
      );
    }

  const definition =
    body?.definition &&
    typeof body.definition ===
      "object" &&
    !Array.isArray(
      body.definition,
    )
      ? body.definition
      : {
          fields: [],
        };

  const formCheck =
    await validateFormOwnership(
      formId,
      auth.user.id,
    );

  if (
    formCheck.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          formCheck.message,
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: application,
    error,
  } = await supabaseAdmin
    .from("applications")
    .insert({
      owner_user_id:
        auth.user.id,

      application_type:
        applicationType,

      title,

      description:
        description || null,

      definition,

      form_id:
        formId,

      acceptance_mode:
        acceptanceMode,
        
    payment_method:
      paymentMethod,

    payment_amount:
      paymentMethod === "none"
        ? null
        : paymentAmount,

    payment_currency:
      "JPY",

    payment_url:
      paymentMethod ===
      "payment_link"
        ? paymentUrl || null
        : null,

    payment_instructions:
      paymentMethod === "none"
        ? null
        : paymentInstructions ||
          null,
        
    payment_confirmation_required:
      normalizedPaymentConfirmationRequired,

      status:
        "draft",
    })
    .select(
      `
        id,
        application_type,
        title,
        description,
        definition,
        form_id,
        acceptance_mode,
        payment_method,
        payment_amount,
        payment_currency,
        payment_url,
        payment_instructions,
        payment_confirmation_required,
        status,
        version,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) {
    console.error(
      "application create failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONを保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    application,
  });
}


// ============================================================
// PATCH
// 既存APPLICATION編集
// ============================================================

export async function PATCH(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        applicationId?: unknown;
        applicationType?: unknown;
        title?: unknown;
        description?: unknown;
        definition?: unknown;
        formId?: unknown;
        acceptanceMode?: unknown;

        paymentMethod?: unknown;
        paymentAmount?: unknown;
        paymentUrl?: unknown;
        paymentInstructions?: unknown;
        paymentConfirmationRequired?: unknown;
      }
    | null;
    
  const applicationId =
    typeof body?.applicationId ===
      "string"
      ? body.applicationId.trim()
      : "";

  const applicationType =
    typeof body?.applicationType ===
      "string"
      ? body.applicationType.trim()
      : "";

  const title =
    typeof body?.title === "string"
      ? body.title.trim()
      : "";

  const description =
    typeof body?.description ===
      "string"
      ? body.description.trim()
      : "";

  const formId =
    typeof body?.formId === "string" &&
    body.formId.trim()
      ? body.formId.trim()
      : null;

  const acceptanceMode =
    typeof body?.acceptanceMode ===
      "string"
      ? body.acceptanceMode.trim()
      : "instant";
    
    const paymentMethod =
      typeof body?.paymentMethod === "string"
        ? body.paymentMethod.trim()
        : "none";

    const paymentAmount =
      typeof body?.paymentAmount === "number"
        ? body.paymentAmount
        : typeof body?.paymentAmount === "string" &&
            body.paymentAmount.trim()
          ? Number(body.paymentAmount)
          : null;

    const paymentUrl =
      typeof body?.paymentUrl === "string"
        ? body.paymentUrl.trim()
        : "";

    const paymentInstructions =
      typeof body?.paymentInstructions === "string"
        ? body.paymentInstructions.trim()
        : "";

    const paymentConfirmationRequired =
      body?.paymentConfirmationRequired === true;
    
    const normalizedPaymentConfirmationRequired =
      (
        paymentMethod === "bank_transfer" ||
        paymentMethod === "payment_link"
      )
        ? paymentConfirmationRequired
        : false;
    
  if (!applicationId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "編集するAPPLICATIONが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isApplicationType(
      applicationType,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONの種類が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "募集名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isAcceptanceMode(
      acceptanceMode,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "受付方法が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }
    
    if (
      !isPaymentMethod(
        paymentMethod,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "支払方法が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      paymentMethod !== "none" &&
      (
        paymentAmount === null ||
        !Number.isFinite(
          paymentAmount,
        ) ||
        paymentAmount <= 0
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "参加費を正しく入力してください。",
        },
        {
          status: 400,
        },
      );
    }

  const definition =
    body?.definition &&
    typeof body.definition ===
      "object" &&
    !Array.isArray(
      body.definition,
    )
      ? body.definition
      : {
          fields: [],
        };

  const formCheck =
    await validateFormOwnership(
      formId,
      auth.user.id,
    );

  if (
    formCheck.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          formCheck.message,
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: application,
    error,
  } = await supabaseAdmin
    .from("applications")
    .update({
      application_type:
        applicationType,

      title,

      description:
        description || null,

      definition,

      form_id:
        formId,

      acceptance_mode:
        acceptanceMode,
        
    payment_method:
      paymentMethod,

    payment_amount:
      paymentMethod === "none"
        ? null
        : paymentAmount,

    payment_currency:
      "JPY",

    payment_url:
      paymentMethod ===
      "payment_link"
        ? paymentUrl || null
        : null,

    payment_instructions:
      paymentMethod === "none"
        ? null
        : paymentInstructions ||
          null,
        
    payment_confirmation_required:
      normalizedPaymentConfirmationRequired,
        
    })
    .eq(
      "id",
      applicationId,
    )
    .eq(
      "owner_user_id",
      auth.user.id,
    )
    .select(
      `
        id,
        application_type,
        title,
        description,
        definition,
        form_id,
        acceptance_mode,
        payment_method,
        payment_amount,
        payment_currency,
        payment_url,
        payment_instructions,
        payment_confirmation_required,
        status,
        version,
        created_at,
        updated_at
      `,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "application update failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONを更新できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  if (!application) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "編集するAPPLICATIONが見つかりません。",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    application,
  });
}
