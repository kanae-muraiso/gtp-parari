import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getEffectivePlan,
  getPlanEntitlements,
  isAtOrOverLimit,
} from "@/lib/billing/plan";
import {
  getUserBillingByUserId,
} from "@/lib/billing/supabaseBilling";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function getApplicationLimit(
  userId: string,
): Promise<
  | {
      ok: true;
      limit: number | null;
    }
  | {
      ok: false;
      message: string;
    }
> {
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
      return {
        ok: false,
        message:
          "利用権限を確認できませんでした。",
      };
    }

    const effectivePlan =
      getEffectivePlan(billing);

    const entitlements =
      getPlanEntitlements(
        effectivePlan,
        profile?.is_monitor === true,
      );

    return {
      ok: true,
      limit:
        entitlements.applicationPanelLimit,
    };
  } catch (error) {
    console.error(
      "[APPLICATION archive] access check failed",
      error,
    );

    return {
      ok: false,
      message:
        "利用権限を確認できませんでした。",
    };
  }
}

async function getActiveManualCount(
  userId: string,
  excludingApplicationId?: string,
) {
  let query =
    supabaseAdmin
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
        userId,
      )
      .eq(
        "origin",
        "manual",
      )
      .is(
        "archived_at",
        null,
      );

  if (excludingApplicationId) {
    query =
      query.neq(
        "id",
        excludingApplicationId,
      );
  }

  return query;
}

export async function PATCH(
  request: NextRequest,
) {
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

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          applicationId?: unknown;
          action?: unknown;
        }
      | null;

  const applicationId =
    typeof body?.applicationId ===
    "string"
      ? body.applicationId.trim()
      : "";

  const action =
    typeof body?.action ===
    "string"
      ? body.action.trim()
      : "";

  if (!applicationId) {
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

  if (
    action !== "archive" &&
    action !== "restore"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "操作内容が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: application,
    error: applicationError,
  } =
    await supabaseAdmin
      .from("applications")
      .select(
        `
          id,
          owner_user_id,
          origin,
          status,
          archived_at
        `,
      )
      .eq(
        "id",
        applicationId,
      )
      .maybeSingle();

  if (
    applicationError ||
    !application
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONを確認できませんでした。",
      },
      {
        status: 404,
      },
    );
  }

  if (
    application.owner_user_id !==
    user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このAPPLICATIONを変更する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }

  if (
    application.origin !== "manual"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "CALENDARから作成されたAPPLICATIONはここではアーカイブできません。",
      },
      {
        status: 400,
      },
    );
  }

  const access =
    await getApplicationLimit(
      user.id,
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

  if (action === "restore") {
    if (!application.archived_at) {
      return NextResponse.json({
        ok: true,
        application,
        message:
          "このAPPLICATIONはすでに現役です。",
      });
    }

    const {
      count,
      error: countError,
    } =
      await getActiveManualCount(
        user.id,
        applicationId,
      );

    if (countError) {
      console.error(
        "[APPLICATION archive] active count failed",
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
        access.limit,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このAPPLICATIONを復活するには、現在のAPPLICATIONを先にアーカイブしてください。",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: restored,
      error: restoreError,
    } =
      await supabaseAdmin
        .from("applications")
        .update({
          archived_at: null,
        })
        .eq(
          "id",
          applicationId,
        )
        .eq(
          "owner_user_id",
          user.id,
        )
        .select(
          `
            id,
            status,
            archived_at,
            updated_at
          `,
        )
        .maybeSingle();

    if (
      restoreError ||
      !restored
    ) {
      console.error(
        "[APPLICATION archive] restore failed",
        restoreError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "APPLICATIONを復活できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      application:
        restored,
      canCreateApplication:
        !isAtOrOverLimit(
          (count ?? 0) + 1,
          access.limit,
        ),
      message:
        "APPLICATIONを復活しました。受付は終了したままです。必要に応じて受付を再開してください。",
    });
  }

  if (application.archived_at) {
    return NextResponse.json({
      ok: true,
      application,
      message:
        "このAPPLICATIONはすでにアーカイブ済みです。",
    });
  }

  const now =
    new Date().toISOString();

  const {
    data: archived,
    error: archiveError,
  } =
    await supabaseAdmin
      .from("applications")
      .update({
        status:
          "closed",
        archived_at:
          now,
      })
      .eq(
        "id",
        applicationId,
      )
      .eq(
        "owner_user_id",
        user.id,
      )
      .select(
        `
          id,
          status,
          archived_at,
          updated_at
        `,
      )
      .maybeSingle();

  if (
    archiveError ||
    !archived
  ) {
    console.error(
      "[APPLICATION archive] archive failed",
      archiveError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONをアーカイブできませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const {
    count: activeCount,
    error: activeCountError,
  } =
    await getActiveManualCount(
      user.id,
    );

  return NextResponse.json({
    ok: true,
    application:
      archived,
    canCreateApplication:
      activeCountError
        ? undefined
        : !isAtOrOverLimit(
            activeCount ?? 0,
            access.limit,
          ),
    message:
      "APPLICATIONをアーカイブしました。申込記録は残っています。",
  });
}
