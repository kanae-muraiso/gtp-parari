import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  canAccessApplicationDelivery,
  createApplicationDeliverySignedUrl,
  getApplicationDeliveryFromSnapshot,
} from "@/features/application/server/delivery";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const TOKEN_RE =
  /^[0-9a-f]{32}$/;

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

function normalizeToken(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function GET(
  request: NextRequest,
) {
  const guestToken =
    normalizeToken(
      request.nextUrl.searchParams.get(
        "token",
      ),
    );

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
        .from(
          "application_entries",
        )
        .select(
          `
            status,
            payment_status,
            application_snapshot,
            applicant_email_verified_at,
            user_id
          `,
        )
        .eq(
          "cancellation_token",
          guestToken,
        )
        .is(
          "user_id",
          null,
        )
        .maybeSingle();

    if (error) {
      console.error(
        "[APPLICATION DELIVERY] guest entry load failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "ダウンロード情報を確認できませんでした。",
        },
        {
          status: 500,
        },
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
            "このダウンロードリンクを利用できません。",
        },
        {
          status: 404,
        },
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
        {
          status: 400,
        },
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
        {
          status: 401,
        },
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
        {
          status: 401,
        },
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          `
            status,
            payment_status,
            application_snapshot
          `,
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
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        "[APPLICATION DELIVERY] member entry load failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "ダウンロード情報を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    entry =
      data ?? null;
  }

  if (!entry) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込情報が見つかりません。",
      },
      {
        status: 404,
      },
    );
  }

  const delivery =
    getApplicationDeliveryFromSnapshot(
      entry.application_snapshot,
    );

  if (!delivery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このAPPLICATIONにはダウンロードファイルがありません。",
      },
      {
        status: 404,
      },
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
          entry.status !==
          "confirmed"
            ? "申込が確定するとダウンロードできます。"
            : "支払確認が完了するとダウンロードできます。",
      },
      {
        status: 409,
      },
    );
  }

  try {
    const signedUrl =
      await createApplicationDeliverySignedUrl(
        delivery,
      );

    return NextResponse.json(
      {
        ok: true,
        delivery: {
          fileName:
            delivery.fileName,
          contentType:
            delivery.contentType,
          size:
            delivery.size,
        },
        signedUrl,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[APPLICATION DELIVERY] signed URL failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "ダウンロードURLを発行できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}
