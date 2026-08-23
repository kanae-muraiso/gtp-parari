// src/app/api/calendar/items/route.ts
// 2026-08-20 JST
//
// PARARI CALENDAR v1
//
// GET  : 自分のcalendar item一覧
// POST : calendar itemを新規作成
// PATCH: calendar itemの基本情報を更新
//
// calendar_items = 「何をするか」のSSOT
// 日時はここでは持たない。
// 日時はcalendar_schedules / calendar_occurrencesが担当する。

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


type CreateCalendarItemBody = {
  title?: unknown;
  durationMinutes?: unknown;
  location?: unknown;
  capacity?: unknown;
  minimumCapacity?: unknown;
  feeAmount?: unknown;
  feeCurrency?: unknown;
  descriptionWorkId?: unknown;
  summary?: unknown;
  showInProfile?: unknown;
};


type UpdateCalendarItemBody =
  CreateCalendarItemBody & {
    calendarItemId?: unknown;
  };


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
      message: "ログインしてください。",
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


function normalizeNullableText(
  value: unknown,
): string | null {
  const text =
    String(value ?? "").trim();

  return text || null;
}


function normalizePositiveInteger(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return null;
  }

  return Math.floor(numberValue);
}


function normalizeNonNegativeNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    return null;
  }

  return numberValue;
}


// ============================================================
// GET
// 自分のcalendar item一覧
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
    data,
    error,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .select(
        `
          id,
          title,
          duration_minutes,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          description_work_id,
          summary,
          show_in_profile,
          status,
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
      "[calendar/items GET] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    items: data ?? [],
  });
}


// ============================================================
// POST
// calendar item新規作成
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

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | CreateCalendarItemBody
      | null;

  const title =
    String(
      body?.title ?? "",
    ).trim();

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (title.length > 120) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント名は120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const durationMinutes =
    normalizePositiveInteger(
      body?.durationMinutes,
    );

  if (!durationMinutes) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "時間を1分以上で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const capacity =
    normalizePositiveInteger(
      body?.capacity,
    );

  const minimumCapacity =
    normalizePositiveInteger(
      body?.minimumCapacity,
    );

  if (
    capacity !== null &&
    minimumCapacity !== null &&
    minimumCapacity > capacity
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "最低開催人数は定員以下にしてください。",
      },
      {
        status: 400,
      },
    );
  }

  const feeAmount =
    normalizeNonNegativeNumber(
      body?.feeAmount,
    );

  const requestedCurrency =
    String(
      body?.feeCurrency ?? "JPY",
    )
      .trim()
      .toUpperCase();

  const feeCurrency =
    /^[A-Z]{3}$/.test(
      requestedCurrency,
    )
      ? requestedCurrency
      : "JPY";

  const descriptionWorkId =
    normalizeNullableText(
      body?.descriptionWorkId,
    );

  const summary =
    normalizeNullableText(
      body?.summary,
    );

  const showInProfile =
    body?.showInProfile === true;

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .insert({
        owner_user_id:
          auth.user.id,

        title,

        duration_minutes:
          durationMinutes,

        location:
          normalizeNullableText(
            body?.location,
          ),

        capacity,

        minimum_capacity:
          minimumCapacity,

        fee_amount:
          feeAmount,

        fee_currency:
          feeCurrency,

        description_work_id:
          descriptionWorkId,

        summary,

        show_in_profile:
          showInProfile,

        status:
          "active",
      })
      .select(
        `
          id,
          title,
          duration_minutes,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          description_work_id,
          summary,
          show_in_profile,
          status,
          created_at,
          updated_at
        `,
      )
      .single();

  if (
    error ||
    !data
  ) {
    console.error(
      "[calendar/items POST] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントを作成できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    item: data,
  });
}
// ============================================================
// PATCH
// calendar itemの基本情報を更新
// calendar_items = 「何をするか」のSSOT
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

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | UpdateCalendarItemBody
      | null;

  const calendarItemId =
    String(
      body?.calendarItemId ?? "",
    ).trim();

  if (!calendarItemId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントを指定してください。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: currentItem,
    error: currentItemError,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .select(
        `
          id,
          title,
          duration_minutes,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          description_work_id,
          summary,
          show_in_profile,
          status
        `,
      )
      .eq(
        "id",
        calendarItemId,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      )
      .maybeSingle();

  if (
    currentItemError ||
    !currentItem
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントが見つかりません。",
      },
      {
        status: 404,
      },
    );
  }

  const has = (
    key: keyof UpdateCalendarItemBody,
  ) =>
    Object.prototype.hasOwnProperty.call(
      body ?? {},
      key,
    );

  const title =
    has("title")
      ? String(
          body?.title ?? "",
        ).trim()
      : String(
          currentItem.title ?? "",
        ).trim();

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (title.length > 120) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント名は120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const durationMinutes =
    has("durationMinutes")
      ? normalizePositiveInteger(
          body?.durationMinutes,
        )
      : Number(
          currentItem.duration_minutes,
        );

  if (!durationMinutes) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "時間を1分以上で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const capacity =
    has("capacity")
      ? normalizePositiveInteger(
          body?.capacity,
        )
      : currentItem.capacity;

  const minimumCapacity =
    has("minimumCapacity")
      ? normalizePositiveInteger(
          body?.minimumCapacity,
        )
      : currentItem.minimum_capacity;

  if (
    capacity !== null &&
    minimumCapacity !== null &&
    minimumCapacity > capacity
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "最低開催人数は定員以下にしてください。",
      },
      {
        status: 400,
      },
    );
  }

  const feeAmount =
    has("feeAmount")
      ? normalizeNonNegativeNumber(
          body?.feeAmount,
        )
      : currentItem.fee_amount;

  const requestedCurrency =
    has("feeCurrency")
      ? String(
          body?.feeCurrency ?? "",
        )
          .trim()
          .toUpperCase()
      : String(
          currentItem.fee_currency ??
            "JPY",
        )
          .trim()
          .toUpperCase();

  const feeCurrency =
    /^[A-Z]{3}$/.test(
      requestedCurrency,
    )
      ? requestedCurrency
      : "JPY";

  const location =
    has("location")
      ? normalizeNullableText(
          body?.location,
        )
      : currentItem.location;

  const descriptionWorkId =
    has("descriptionWorkId")
      ? normalizeNullableText(
          body?.descriptionWorkId,
        )
      : currentItem.description_work_id;

  const summary =
    has("summary")
      ? normalizeNullableText(
          body?.summary,
        )
      : currentItem.summary;

  const showInProfile =
    has("showInProfile")
      ? body?.showInProfile === true
      : currentItem.show_in_profile === true;

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .update({
        title,
        duration_minutes:
          durationMinutes,
        location,
        capacity,
        minimum_capacity:
          minimumCapacity,
        fee_amount:
          feeAmount,
        fee_currency:
          feeCurrency,
        description_work_id:
          descriptionWorkId,
        summary,
        show_in_profile:
          showInProfile,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        calendarItemId,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      )
      .select(
        `
          id,
          title,
          duration_minutes,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          description_work_id,
          summary,
          show_in_profile,
          status,
          created_at,
          updated_at
        `,
      )
      .single();

  if (
    error ||
    !data
  ) {
    console.error(
      "[calendar/items PATCH] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントを更新できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    item: data,
  });
}
