// src/app/api/application/entries/route.ts
// 2026/08/16 8:58

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


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


type FormSnapshotField = {
  id?: unknown;
  label?: unknown;
  type?: unknown;
};


function resolveFormAnswers(
  formSnapshot: unknown,
  answers: unknown,
) {
  if (
    !formSnapshot ||
    typeof formSnapshot !== "object" ||
    Array.isArray(formSnapshot)
  ) {
    return [];
  }

  if (
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    return [];
  }

  const snapshot =
    formSnapshot as {
      definition?: {
        fields?: unknown;
      };
    };

  const fields =
    Array.isArray(
      snapshot.definition?.fields,
    )
      ? (
          snapshot.definition
            ?.fields as FormSnapshotField[]
        )
      : [];

  const answerMap =
    answers as Record<
      string,
      unknown
    >;

  return fields
    .map((field) => {
      const id =
        typeof field.id ===
        "string"
          ? field.id.trim()
          : "";

      if (!id) {
        return null;
      }

      return {
        field_id: id,

        label:
          typeof field.label ===
          "string"
            ? field.label
            : "項目",

        type:
          typeof field.type ===
          "string"
            ? field.type
            : "text",

        value:
          answerMap[id] ??
          null,
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<
        typeof item
      > => item !== null,
    );
}


export async function GET(
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
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  const user =
    authData.user;

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

  const applicationId =
    request.nextUrl.searchParams
      .get("applicationId")
      ?.trim() ?? "";

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
          title,
          acceptance_mode,
          status
        `,
      )
      .eq(
        "id",
        applicationId,
      )
      .maybeSingle();

  if (
    applicationError
  ) {
    console.error(
      "[APPLICATION entries] application load failed",
      applicationError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONを確認できませんでした。",
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
          "APPLICATIONが見つかりません。",
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
          "このAPPLICATIONの申込者を見る権限がありません。",
      },
      {
        status: 403,
      },
    );
  }

  const {
    data: entries,
    error: entriesError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        `
          id,
          application_id,
          application_version,
          user_id,
          form_submission_id,
          status,
          agreed_at,
          created_at,
          updated_at
        `,
      )
      .eq(
        "application_id",
        applicationId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

  if (entriesError) {
    console.error(
      "[APPLICATION entries] entries load failed",
      entriesError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申込者一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const rows =
    entries ?? [];

  const userIds =
    Array.from(
      new Set(
        rows
          .map(
            (row) =>
              row.user_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                "string" &&
              value.length > 0,
          ),
      ),
    );

  const submissionIds =
    Array.from(
      new Set(
        rows
          .map(
            (row) =>
              row.form_submission_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                "string" &&
              value.length > 0,
          ),
      ),
    );


  const profileMap =
    new Map<
      string,
      {
        username:
          | string
          | null;
        display_name:
          | string
          | null;
      }
    >();

  if (
    userIds.length >
    0
  ) {
    const {
      data: profiles,
      error: profilesError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          `
            user_id,
            username,
            display_name
          `,
        )
        .in(
          "user_id",
          userIds,
        );

    if (profilesError) {
      console.error(
        "[APPLICATION entries] profiles load failed",
        profilesError,
      );
    } else {
      for (
        const profile of
        profiles ?? []
      ) {
        profileMap.set(
          profile.user_id,
          {
            username:
              profile.username ??
              null,

            display_name:
              profile.display_name ??
              null,
          },
        );
      }
    }
  }


  const emailMap =
    new Map<
      string,
      string | null
    >();

  await Promise.all(
    userIds.map(
      async (userId) => {
        const {
          data,
          error,
        } =
          await supabaseAdmin
            .auth.admin
            .getUserById(
              userId,
            );

        if (error) {
          console.error(
            "[APPLICATION entries] auth user load failed",
            {
              userId,
              error,
            },
          );

          emailMap.set(
            userId,
            null,
          );

          return;
        }

        emailMap.set(
          userId,
          data.user?.email ??
            null,
        );
      },
    ),
  );


  const submissionMap =
    new Map<
      string,
      {
        id: string;
        submitted_at:
          | string
          | null;
        form_snapshot:
          unknown;
        answers:
          unknown;
      }
    >();

  if (
    submissionIds.length >
    0
  ) {
    const {
      data: submissions,
      error:
        submissionsError,
    } =
      await supabaseAdmin
        .from(
          "form_submissions",
        )
        .select(
          `
            id,
            submitted_at,
            form_snapshot,
            answers
          `,
        )
        .in(
          "id",
          submissionIds,
        );

    if (
      submissionsError
    ) {
      console.error(
        "[APPLICATION entries] form submissions load failed",
        submissionsError,
      );
    } else {
      for (
        const submission of
        submissions ?? []
      ) {
        submissionMap.set(
          submission.id,
          submission,
        );
      }
    }
  }


  const resultEntries =
    rows.map((entry) => {
      const profile =
        entry.user_id
          ? profileMap.get(
              entry.user_id,
            )
          : undefined;

      const submission =
        entry.form_submission_id
          ? submissionMap.get(
              entry.form_submission_id,
            )
          : undefined;

      return {
        id:
          entry.id,

        status:
          entry.status,

        application_version:
          entry.application_version,

        agreed_at:
          entry.agreed_at,

        created_at:
          entry.created_at,

        applicant: {
          user_id:
            entry.user_id,

          email:
            entry.user_id
              ? (
                  emailMap.get(
                    entry.user_id,
                  ) ??
                  null
                )
              : null,

          username:
            profile?.username ??
            null,

          display_name:
            profile
              ?.display_name ??
            null,
        },

        form_submission:
          submission
            ? {
                id:
                  submission.id,

                submitted_at:
                  submission
                    .submitted_at,

                form_snapshot:
                  submission
                    .form_snapshot,

                answers:
                  resolveFormAnswers(
                    submission
                      .form_snapshot,
                    submission
                      .answers,
                  ),
              }
            : null,
      };
    });


  return NextResponse.json({
    ok: true,

    application: {
      id:
        application.id,

      title:
        application.title,

      acceptance_mode:
        application.acceptance_mode,

      status:
        application.status,
    },

    entries:
      resultEntries,
  });
}
