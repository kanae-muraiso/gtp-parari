// src/app/api/application/my-entries/route.ts
// 2026/08/16 12:53

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";


type JsonRecord =
  Record<string, unknown>;


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}


function asRecord(
  value: unknown,
): JsonRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}


function resolveApplicationAnswers(
  applicationSnapshot: unknown,
  answers: unknown,
) {
  const snapshot =
    asRecord(applicationSnapshot);

  const definition =
    asRecord(
      snapshot?.definition,
    );

  const fields =
    Array.isArray(
      definition?.inputFields,
    )
      ? definition.inputFields
      : [];

  const answerRecord =
    asRecord(answers) ?? {};

  return fields
    .map((field) => {
      const row =
        asRecord(field);

      if (!row) {
        return null;
      }

      const id =
        typeof row.id === "string"
          ? row.id
          : "";

      if (
        !id ||
        !Object.prototype.hasOwnProperty.call(
          answerRecord,
          id,
        )
      ) {
        return null;
      }

      return {
        field_id: id,

        label:
          typeof row.label === "string"
            ? row.label
            : "",

        type:
          typeof row.kind === "string"
            ? row.kind
            : "text",

        value:
          answerRecord[id] ??
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


function resolveFormAnswers(
  formSnapshot: unknown,
  answers: unknown,
) {
  const snapshot =
    asRecord(formSnapshot);

  const definition =
    asRecord(
      snapshot?.definition,
    );

  const fields =
    Array.isArray(
      definition?.fields,
    )
      ? definition.fields
      : [];

  const answerRecord =
    asRecord(answers) ?? {};

  return fields
    .map((field) => {
      const row =
        asRecord(field);

      if (!row) {
        return null;
      }

      const id =
        typeof row.id === "string"
          ? row.id
          : "";

      if (!id) {
        return null;
      }

      return {
        field_id: id,

        label:
          typeof row.label ===
          "string"
            ? row.label
            : "",

        type:
          typeof row.type ===
          "string"
            ? row.type
            : "text",

        value:
          answerRecord[id] ??
          null,
      };
    })
    .filter(
      (
        row,
      ): row is NonNullable<
        typeof row
      > => Boolean(row),
    );
}


function normalizeApplicationAnswerUpdate(
  applicationSnapshot: unknown,
  rawAnswers: unknown,
):
  | {
      ok: true;
      answers: Record<
        string,
        string | boolean
      >;
    }
  | {
      ok: false;
      message: string;
    } {
  const snapshot =
    asRecord(applicationSnapshot);

  const definition =
    asRecord(
      snapshot?.definition,
    );

  const inputFields =
    Array.isArray(
      definition?.inputFields,
    )
      ? definition.inputFields
      : [];

  const blocks =
    Array.isArray(
      definition?.blocks,
    )
      ? definition.blocks
      : [];

  const activeFieldIds =
    new Set(
      blocks
        .map((block) => {
          const row =
            asRecord(block);

          if (
            !row ||
            row.type !== "field"
          ) {
            return "";
          }

          return typeof row.fieldId ===
            "string"
            ? row.fieldId.trim()
            : "";
        })
        .filter(Boolean),
    );

  if (
    activeFieldIds.size === 0
  ) {
    return {
      ok: true,
      answers: {},
    };
  }

  const answerRecord =
    asRecord(rawAnswers) ?? {};

  const normalized:
    Record<
      string,
      string | boolean
    > = {};

  for (
    const rawField of inputFields
  ) {
    const field =
      asRecord(rawField);

    if (!field) {
      continue;
    }

    const id =
      typeof field.id === "string"
        ? field.id.trim()
        : "";

    if (
      !id ||
      !activeFieldIds.has(id)
    ) {
      continue;
    }

    const label =
      typeof field.label === "string" &&
      field.label.trim()
        ? field.label.trim()
        : "項目";

    const kind =
      typeof field.kind === "string"
        ? field.kind.trim()
        : "";

    const rawValue =
      answerRecord[id];

    if (
      kind === "checkbox"
    ) {
      const checked =
        rawValue === true;

      if (
        field.required === true &&
        !checked
      ) {
        return {
          ok: false,
          message:
            `「${label}」にチェックしてください。`,
        };
      }

      normalized[id] =
        checked;

      continue;
    }

    const value =
      typeof rawValue === "string"
        ? rawValue.trim()
        : "";

    if (
      kind === "radio" ||
      kind === "select"
    ) {
      const options =
        Array.isArray(
          field.options,
        )
          ? field.options
              .filter(
                (
                  option,
                ): option is string =>
                  typeof option ===
                  "string",
              )
              .map((option) =>
                option.trim(),
              )
              .filter(Boolean)
          : [];

      if (options.length === 0) {
        return {
          ok: false,
          message:
            `「${label}」の選択肢が設定されていません。`,
        };
      }

      if (
        value &&
        !options.includes(value)
      ) {
        return {
          ok: false,
          message:
            `「${label}」の選択肢を確認してください。`,
        };
      }
    }

    if (
      field.required === true &&
      !value
    ) {
      return {
        ok: false,
        message:
          `「${label}」を入力してください。`,
      };
    }

    normalized[id] = value;
  }

  return {
    ok: true,
    answers: normalized,
  };
}


export async function GET(
  request: NextRequest,
) {
  try {
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

    const {
      data: entries,
      error: entriesError,
    } = await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        `
          id,
          application_id,
          application_version,
          form_submission_id,
          status,
          application_snapshot,
          answers,
          agreed_at,
          created_at,
          updated_at
        `,
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
      );

    if (entriesError) {
      console.error(
        "load my application entries failed:",
        entriesError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "申し込み履歴を取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * /my/applications は
     * 「通常のAPPLICATION申込」だけを表示する。
     *
     * CALENDAR由来の予約は
     * /my/calendar 側で扱う。
     */
    const applicationIds =
      Array.from(
        new Set(
          (entries ?? [])
            .map(
              (entry) =>
                entry.application_id,
            )
            .filter(
              (
                id,
              ): id is string =>
                typeof id ===
                  "string" &&
                Boolean(id),
            ),
        ),
      );


    const calendarApplicationIds =
      new Set<string>();


    if (
      applicationIds.length > 0
    ) {
      const {
        data: applications,
        error:
          applicationsError,
      } =
        await supabaseAdmin
          .from(
            "applications",
          )
          .select(
            `
              id,
              origin
            `,
          )
          .in(
            "id",
            applicationIds,
          );


      if (applicationsError) {
        console.error(
          "load application origins failed:",
          applicationsError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "申し込み履歴を取得できませんでした。",
          },
          {
            status: 500,
          },
        );
      }


      for (
        const application of
        applications ?? []
      ) {
        if (
          application.origin ===
          "calendar"
        ) {
          calendarApplicationIds.add(
            application.id,
          );
        }
      }
    }


    const visibleEntries =
      (entries ?? []).filter(
        (entry) =>
          !calendarApplicationIds.has(
            entry.application_id,
          ),
      );


    const submissionIds =
      Array.from(
        new Set(
          visibleEntries
            .map(
              (entry) =>
                entry.form_submission_id,
            )
            .filter(
              (
                id,
              ): id is string =>
                typeof id ===
                  "string" &&
                Boolean(id),
            ),
        ),
      );

    const submissionsById =
      new Map<
        string,
        {
          id: string;
          submitted_at:
            | string
            | null;
          form_snapshot:
            unknown;
          answers: unknown;
        }
      >();

    if (
      submissionIds.length > 0
    ) {
      const {
        data: submissions,
        error:
          submissionsError,
      } = await supabaseAdmin
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

      if (submissionsError) {
        console.error(
          "load my form submissions failed:",
          submissionsError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "申込内容を取得できませんでした。",
          },
          {
            status: 500,
          },
        );
      }

      for (
        const submission of
        submissions ?? []
      ) {
        submissionsById.set(
          submission.id,
          submission,
        );
      }
    }

    const result =
      visibleEntries.map(
        (entry) => {
          const snapshot =
            asRecord(
              entry.application_snapshot,
            ) ?? {};

          const submission =
            entry.form_submission_id
              ? submissionsById.get(
                  entry.form_submission_id,
                )
              : null;

          return {
            id: entry.id,

            status:
              entry.status,

            created_at:
              entry.created_at,

            agreed_at:
              entry.agreed_at,

            application_version:
              entry.application_version,

            application: {
              id:
                typeof snapshot.id ===
                "string"
                  ? snapshot.id
                  : entry.application_id,

              type:
                typeof snapshot.type ===
                "string"
                  ? snapshot.type
                  : typeof snapshot.application_type ===
                      "string"
                    ? snapshot.application_type
                    : null,

              title:
                typeof snapshot.title ===
                "string"
                  ? snapshot.title
                  : "APPLICATION",

              description:
                typeof snapshot.description ===
                "string"
                  ? snapshot.description
                  : null,

              definition:
                snapshot.definition ??
                null,

              acceptance_mode:
                typeof snapshot.acceptance_mode ===
                "string"
                  ? snapshot.acceptance_mode
                  : null,

              version:
                typeof snapshot.version ===
                "number"
                  ? snapshot.version
                  : entry.application_version,
            },

            answers:
              resolveApplicationAnswers(
                entry.application_snapshot,
                entry.answers,
              ),

            form_submission:
              submission
                ? {
                    id:
                      submission.id,

                    submitted_at:
                      submission.submitted_at,

                    form_snapshot:
                      submission.form_snapshot,

                    answers:
                      resolveFormAnswers(
                        submission.form_snapshot,
                        submission.answers,
                      ),
                  }
                : null,
          };
        },
      );

    return NextResponse.json({
      ok: true,
      entries: result,
    });
  } catch (error) {
    console.error(
      "GET /api/application/my-entries failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申し込み履歴を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}


export async function PATCH(
  request: NextRequest,
) {
  try {
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

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            entryId?: unknown;
            answers?: unknown;
          }
        | null;

    const entryId =
      typeof body?.entryId ===
      "string"
        ? body.entryId.trim()
        : "";

    if (
      !UUID_RE.test(entryId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "申込情報が指定されていません。",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: entry,
      error: entryError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          `
            id,
            user_id,
            status,
            application_snapshot
          `,
        )
        .eq(
          "id",
          entryId,
        )
        .eq(
          "user_id",
          user.id,
        )
        .maybeSingle();

    if (entryError) {
      console.error(
        "[APPLICATION my-entries PATCH] entry load failed",
        entryError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "申込情報を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
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

    if (
      entry.status !==
        "submitted" &&
      entry.status !==
        "confirmed"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この申込内容は現在変更できません。",
        },
        {
          status: 400,
        },
      );
    }

    const normalized =
      normalizeApplicationAnswerUpdate(
        entry.application_snapshot,
        body?.answers,
      );

    if (
      normalized.ok === false
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            normalized.message,
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: updated,
      error: updateError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .update({
          answers:
            normalized.answers,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          entry.id,
        )
        .eq(
          "user_id",
          user.id,
        )
        .select(
          `
            id,
            answers,
            application_snapshot
          `,
        )
        .single();

    if (
      updateError ||
      !updated
    ) {
      console.error(
        "[APPLICATION my-entries PATCH] update failed",
        updateError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "申込内容を変更できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      answers:
        resolveApplicationAnswers(
          updated.application_snapshot,
          updated.answers,
        ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/application/my-entries failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申込内容を変更できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}

