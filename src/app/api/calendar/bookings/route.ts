// src/app/api/calendar/bookings/route.ts
// 2026-08-20 JST
//
// PARARI CALENDAR v1
//
// CALENDAR由来の予約受付APPLICATIONを管理する。
//
// GET
// - 自分のcalendar booking一覧
//
// POST
// - 予約受付 ON / OFF
//
// 重要:
// - CALENDAR bookingは通常APPLICATIONとは別枠
// - application origin = "calendar"
// - calendar_item 1件につきAPPLICATION 1件
// - OFFにしてもAPPLICATIONは削除しない
//   （過去の申込記録を保持するため）

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


type BookingBody = {
  calendarItemId?: unknown;
  enabled?: unknown;
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


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(
      request,
    );

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログインしてください。",
    };
  }


  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth
      .getUser(
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


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );


  if (
    auth.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }


  const calendarItemId =
    request.nextUrl
      .searchParams
      .get(
        "calendarItemId",
      )
      ?.trim() ?? "";


  let query =
    supabaseAdmin
      .from("applications")
      .select(
        `
          id,
          calendar_item_id,
          title,
          status,
          acceptance_mode,
          definition,
          created_at,
          updated_at
        `,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      )
      .eq(
        "origin",
        "calendar",
      );


  if (
    calendarItemId
  ) {
    query =
      query.eq(
        "calendar_item_id",
        calendarItemId,
      );
  }


  const {
    data,
    error,
  } =
    await query.order(
      "created_at",
      {
        ascending: false,
      },
    );


  if (error) {
    console.error(
      "[calendar/bookings GET] failed:",
      error,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "予約受付情報を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    bookings:
      data ?? [],
  });
}


// ============================================================
// POST
// 予約受付 ON / OFF
// ============================================================

export async function POST(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );


  if (
    auth.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }


  const body =
    (await request
      .json()
      .catch(
        () => null,
      )) as
      | BookingBody
      | null;


  const calendarItemId =
    String(
      body?.calendarItemId ??
        "",
    ).trim();


  const enabled =
    body?.enabled ===
    true;


  if (
    !calendarItemId
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }


  /*
   * calendar item所有権確認
   */
  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .select(
        `
          id,
          title,
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
    itemError ||
    !item
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "指定されたクラス・イベントを使用できません。",
      },
      {
        status: 404,
      },
    );
  }


  if (
    item.status !==
    "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このクラス・イベントは現在使用できません。",
      },
      {
        status: 400,
      },
    );
  }


  /*
   * 既存booking APPLICATION
   */
  const {
    data:
      existingApplication,
    error:
      existingError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          calendar_item_id,
          title,
          status,
          acceptance_mode
        `,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      )
      .eq(
        "origin",
        "calendar",
      )
      .eq(
        "calendar_item_id",
        calendarItemId,
      )
      .maybeSingle();


  if (existingError) {
    console.error(
      "[calendar/bookings] lookup failed:",
      existingError,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "予約受付情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  /*
   * OFF
   *
   * APPLICATION自体は削除しない。
   * 過去のapplication_entriesを保持する。
   */
  if (!enabled) {
    if (
      !existingApplication
    ) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        booking: null,
      });
    }


    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .update({
          status:
            "closed",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existingApplication.id,
        )
        .eq(
          "owner_user_id",
          auth.user.id,
        )
        .eq(
          "origin",
          "calendar",
        )
        .select(
          `
            id,
            calendar_item_id,
            title,
            status,
            acceptance_mode
          `,
        )
        .single();


    if (
      error ||
      !data
    ) {
      console.error(
        "[calendar/bookings OFF] failed:",
        error,
      );


      return NextResponse.json(
        {
          ok: false,
          message:
            "予約受付を停止できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    return NextResponse.json({
      ok: true,
      enabled: false,
      booking:
        data,
    });
  }


  /*
   * ON
   *
   * 既存APPLICATIONがあれば再OPEN。
   */
  if (
    existingApplication
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .update({
          status:
            "open",

          title:
            `${item.title} 予約`,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existingApplication.id,
        )
        .eq(
          "owner_user_id",
          auth.user.id,
        )
        .eq(
          "origin",
          "calendar",
        )
        .select(
          `
            id,
            calendar_item_id,
            title,
            status,
            acceptance_mode
          `,
        )
        .single();


    if (
      error ||
      !data
    ) {
      console.error(
        "[calendar/bookings reopen] failed:",
        error,
      );


      return NextResponse.json(
        {
          ok: false,
          message:
            "予約受付を開始できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    return NextResponse.json({
      ok: true,
      enabled: true,
      booking:
        data,
    });
  }


  /*
   * CALENDAR由来APPLICATIONを初回生成
   *
   * 日時 / 会場 / 定員 / 料金は
   * APPLICATIONには複製しない。
   *
   * CALENDAR / OCCURRENCEがSSOT。
   */
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .insert({
        owner_user_id:
          auth.user.id,

        application_type:
          "EVENT",

        title:
          `${item.title} 予約`,

        description:
          null,

        definition: {
          fields: [],
          actionLabel:
            "予約する",
        },

        form_id:
          null,

        acceptance_mode:
          "instant",

        status:
          "open",

        origin:
          "calendar",

        calendar_item_id:
          item.id,

        payment_method:
          "none",

        payment_amount:
          null,

        payment_confirmation_required:
          false,
      })
      .select(
        `
          id,
          calendar_item_id,
          title,
          status,
          acceptance_mode
        `,
      )
      .single();


  if (
    error ||
    !data
  ) {
    console.error(
      "[calendar/bookings create] failed:",
      error,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "予約受付を開始できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    enabled: true,
    booking:
      data,
  });
}



type CalendarBookingSettingsBody = {
  calendarItemId?: unknown;
  enabled?: unknown;
  acceptanceMode?: unknown;
  deadlineMinutesBefore?: unknown;
  recurringBookingEnabled?: unknown;
};


function asRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return {
      ...(value as Record<string, unknown>),
    };
  }

  return {};
}


export async function PATCH(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );

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
      | CalendarBookingSettingsBody
      | null;

  const calendarItemId =
    String(
      body?.calendarItemId ??
        "",
    ).trim();

  const enabled =
    body?.enabled === true;

  const acceptanceMode =
    body?.acceptanceMode ===
    "approval"
      ? "approval"
      : body?.acceptanceMode ===
          "instant"
        ? "instant"
        : null;

  const rawDeadline =
    Number(
      body
        ?.deadlineMinutesBefore,
    );

  const recurringBookingEnabled =
    body
      ?.recurringBookingEnabled ===
    true;

  if (!calendarItemId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (!acceptanceMode) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "受付方法を確認してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isFinite(
      rawDeadline,
    ) ||
    rawDeadline < 0 ||
    !Number.isInteger(
      rawDeadline,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約締切を確認してください。",
      },
      {
        status: 400,
      },
    );
  }

  const deadlineMinutesBefore =
    Math.min(
      rawDeadline,
      525600,
    );

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .select(
        `
          id,
          title,
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
    itemError ||
    !item
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "指定されたクラス・イベントを使用できません。",
      },
      {
        status: 404,
      },
    );
  }

  if (
    item.status !==
    "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このクラス・イベントは現在使用できません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data:
      existingApplication,
    error:
      existingError,
  } =
    await supabaseAdmin
      .from("applications")
      .select(
        `
          id,
          definition,
          version
        `,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
      )
      .eq(
        "origin",
        "calendar",
      )
      .eq(
        "calendar_item_id",
        calendarItemId,
      )
      .maybeSingle();

  if (existingError) {
    console.error(
      "[calendar/bookings PATCH] lookup failed:",
      existingError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "予約設定を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const definition =
    asRecord(
      existingApplication
        ?.definition,
    );

  const fields =
    Array.isArray(
      definition.fields,
    )
      ? definition.fields
      : [];

  const actionLabel =
    typeof definition
      .actionLabel ===
    "string"
      ? definition.actionLabel
      : "予約する";

  const nextDefinition = {
    ...definition,

    fields,

    actionLabel,

    calendarBooking: {
      deadlineMinutesBefore,
      recurringBookingEnabled,
    },
  };

  const nextStatus =
    enabled
      ? "open"
      : "closed";

  if (existingApplication) {
    const oldVersion =
      Number(
        existingApplication
          .version ??
          1,
      );

    const nextVersion =
      Number.isFinite(
        oldVersion,
      )
        ? Math.max(
            1,
            Math.floor(
              oldVersion,
            ) + 1,
          )
        : 2;

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("applications")
        .update({
          title:
            `${item.title} 予約`,

          status:
            nextStatus,

          acceptance_mode:
            acceptanceMode,

          definition:
            nextDefinition,

          version:
            nextVersion,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existingApplication.id,
        )
        .eq(
          "owner_user_id",
          auth.user.id,
        )
        .eq(
          "origin",
          "calendar",
        )
        .select(
          `
            id,
            calendar_item_id,
            title,
            status,
            acceptance_mode,
            definition,
            version
          `,
        )
        .single();

    if (
      error ||
      !data
    ) {
      console.error(
        "[calendar/bookings PATCH] update failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "予約設定を保存できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      booking: data,
    });
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("applications")
      .insert({
        owner_user_id:
          auth.user.id,

        application_type:
          "EVENT",

        title:
          `${item.title} 予約`,

        description:
          null,

        definition:
          nextDefinition,

        form_id:
          null,

        acceptance_mode:
          acceptanceMode,

        status:
          nextStatus,

        origin:
          "calendar",

        calendar_item_id:
          item.id,

        payment_method:
          "none",

        payment_amount:
          null,

        payment_confirmation_required:
          false,
      })
      .select(
        `
          id,
          calendar_item_id,
          title,
          status,
          acceptance_mode,
          definition,
          version
        `,
      )
      .single();

  if (
    error ||
    !data
  ) {
    console.error(
      "[calendar/bookings PATCH] create failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "予約設定を保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    booking: data,
  });
}
