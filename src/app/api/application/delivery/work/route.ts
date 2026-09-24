import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  canAccessApplicationDelivery,
  getApplicationDeliveryFromSnapshot,
} from "@/features/application/server/delivery";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TOKEN_RE =
  /^[0-9a-f]{32}$/;

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return match?.[1]?.trim() || null;
}

export async function GET(
  request: NextRequest,
) {
  const guestToken =
    String(
      request.nextUrl.searchParams.get(
        "token",
      ) ?? "",
    )
      .trim()
      .toLowerCase();

  const applicationId =
    String(
      request.nextUrl.searchParams.get(
        "applicationId",
      ) ?? "",
    ).trim();

  let entry:
    | {
        status: string;
        payment_status: string;
        application_snapshot: unknown;
        applicant_email_verified_at?: string | null;
      }
    | null = null;

  if (
    guestToken &&
    TOKEN_RE.test(guestToken)
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("application_entries")
        .select(
          "status,payment_status,application_snapshot,applicant_email_verified_at",
        )
        .eq(
          "cancellation_token",
          guestToken,
        )
        .maybeSingle();

    if (error) {
      console.error(
        "[APPLICATION WORK ACCESS] guest entry load failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "作品へのアクセスを確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (
      !data ||
      !data.applicant_email_verified_at
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このアクセスリンクを利用できません。",
        },
        { status: 404 },
      );
    }

    entry = data;
  } else {
    if (
      !UUID_RE.test(
        applicationId,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "APPLICATIONを確認してください。",
        },
        { status: 400 },
      );
    }

    const token =
      getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログインが必要です。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログイン状態を確認できませんでした。",
        },
        { status: 401 },
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("application_entries")
        .select(
          "status,payment_status,application_snapshot",
        )
        .eq(
          "application_id",
          applicationId,
        )
        .eq(
          "user_id",
          user.id,
        )
        .order(
          "created_at",
          { ascending: false },
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        "[APPLICATION WORK ACCESS] member entry load failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "作品へのアクセスを確認できませんでした。",
        },
        { status: 500 },
      );
    }

    entry = data ?? null;
  }

  if (!entry) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込情報が見つかりません。",
      },
      { status: 404 },
    );
  }

  const delivery =
    getApplicationDeliveryFromSnapshot(
      entry.application_snapshot,
    );

  if (
    !delivery ||
    delivery.kind !== "work"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このAPPLICATIONにはPARARI作品のACCESSがありません。",
      },
      { status: 404 },
    );
  }

  if (
    !canAccessApplicationDelivery(
      entry,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          entry.status !== "confirmed"
            ? "申込が確定すると作品を読めます。"
            : "支払確認が完了すると作品を読めます。",
      },
      { status: 409 },
    );
  }

  const {
    data: work,
    error: workError,
  } =
    await supabaseAdmin
      .from("parari_books")
      .select(
        "id,title,content,owner,render_mode,physical_pagination,is_deleted,updated_at",
      )
      .eq(
        "id",
        delivery.workId,
      )
      .maybeSingle();

  if (
    workError ||
    !work ||
    work.is_deleted === true
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この作品は現在読むことができません。",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      work: {
        id: work.id,
        title:
          work.title ||
          delivery.workTitle,
        content:
          work.content ?? "",
        owner:
          work.owner,
        render_mode:
          work.render_mode ?? null,
        physical_pagination:
          work.physical_pagination === true,
        updated_at:
          work.updated_at ?? null,
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store, private",
      },
    },
  );
}
