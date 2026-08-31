// src/app/my/applications/page.tsx
// 2026/08/16 12:56

"use client";

import * as React from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import ApplicationEntryMessagePanel from "@/components/parari/application/ApplicationEntryMessagePanel";

type EntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";


type Answer = {
  field_id: string;
  label: string;
  type: string;
  value: unknown;
};


type MyApplicationEntry = {
  id: string;

  status: EntryStatus;

  created_at: string;

  agreed_at:
    | string
    | null;

  application_version:
    number;

  application: {
    id: string;
    type: string | null;
    title: string;
    description:
      | string
      | null;
    definition: unknown;
    acceptance_mode:
      | string
      | null;
    version: number;
  };

  answers: Answer[];

  form_submission: {
    id: string;

    submitted_at:
      | string
      | null;

    form_snapshot: unknown;

    answers: Answer[];
  } | null;
};


type ParticipatingClass = {
  schedule_id: string;

  application_id:
    | string
    | null;

  title: string;

  location:
    | string
    | null;

  next_occurrence_id:
    | string
    | null;

  next_starts_at:
    | string
    | null;

  next_ends_at:
    | string
    | null;

  timezone:
    | string
    | null;

  reservation_count: number;
  pending_count: number;
  auto_booking: boolean;
};


function getViewerTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "Asia/Tokyo"
    );
  } catch {
    return "Asia/Tokyo";
  }
}


function formatDateTimeInTimezone(
  value:
    | string
    | null
    | undefined,
  timezone:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }


  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          timezone ||
          "Asia/Tokyo",

        year:
          "numeric",

        month:
          "numeric",

        day:
          "numeric",

        weekday:
          "short",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      },
    ).format(
      date,
    );
  } catch {
    return "—";
  }
}


function formatDateTime(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}


function statusLabel(
  status: EntryStatus,
) {
  switch (status) {
    case "submitted":
      return "承認待ち";

    case "confirmed":
      return "確定";

    case "rejected":
      return "受付されませんでした";

    case "withdrawn":
      return "取下げ";

    case "cancelled":
      return "キャンセル";

    default:
      return status;
  }
}


function formatValue(
  value: unknown,
) {
  if (value === true) {
    return "はい";
  }

  if (value === false) {
    return "いいえ";
  }

  if (
    value === null ||
    typeof value ===
      "undefined" ||
    value === ""
  ) {
    return "—";
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map(String)
      .join("、");
  }

  if (
    typeof value ===
    "object"
  ) {
    return JSON.stringify(
      value,
    );
  }

  return String(value);
}


function getApplicationFields(
  definition: unknown,
) {
  if (
    !definition ||
    typeof definition !==
      "object" ||
    Array.isArray(definition)
  ) {
    return [];
  }

  const fields =
    (
      definition as {
        fields?: unknown;
      }
    ).fields;

  if (
    !Array.isArray(fields)
  ) {
    return [];
  }

  return fields
    .map((field) => {
      if (
        !field ||
        typeof field !==
          "object" ||
        Array.isArray(field)
      ) {
        return null;
      }

      const row =
        field as Record<
          string,
          unknown
        >;

      return {
        id:
          typeof row.id ===
          "string"
            ? row.id
            : crypto.randomUUID(),

        label:
          typeof row.label ===
          "string"
            ? row.label
            : "",

        value:
          row.value ?? null,
      };
    })
    .filter(
      (
        field,
      ): field is NonNullable<
        typeof field
      > => Boolean(field),
    );
}


type EditableApplicationInputField = {
  id: string;
  kind: string;
  label: string;
  required: boolean;
};


function getApplicationInputFieldsForEntry(
  definition: unknown,
): EditableApplicationInputField[] {
  if (
    !definition ||
    typeof definition !==
      "object" ||
    Array.isArray(definition)
  ) {
    return [];
  }

  const row =
    definition as Record<
      string,
      unknown
    >;

  const rawInputFields =
    Array.isArray(
      row.inputFields,
    )
      ? row.inputFields
      : [];

  const fieldMap =
    new Map<
      string,
      EditableApplicationInputField
    >();

  for (
    const rawField of
      rawInputFields
  ) {
    if (
      !rawField ||
      typeof rawField !==
        "object" ||
      Array.isArray(rawField)
    ) {
      continue;
    }

    const field =
      rawField as Record<
        string,
        unknown
      >;

    const id =
      typeof field.id ===
      "string"
        ? field.id.trim()
        : "";

    if (!id) {
      continue;
    }

    fieldMap.set(
      id,
      {
        id,

        kind:
          typeof field.kind ===
          "string"
            ? field.kind
            : "text",

        label:
          typeof field.label ===
          "string"
            ? field.label
            : "項目",

        required:
          field.required === true,
      },
    );
  }

  const rawBlocks =
    Array.isArray(
      row.blocks,
    )
      ? row.blocks
      : [];

  const ordered =
    rawBlocks
      .map((rawBlock) => {
        if (
          !rawBlock ||
          typeof rawBlock !==
            "object" ||
          Array.isArray(rawBlock)
        ) {
          return null;
        }

        const block =
          rawBlock as Record<
            string,
            unknown
          >;

        if (
          block.type !==
          "field"
        ) {
          return null;
        }

        const fieldId =
          typeof block.fieldId ===
          "string"
            ? block.fieldId
            : "";

        return (
          fieldMap.get(
            fieldId,
          ) ?? null
        );
      })
      .filter(
        (
          field,
        ): field is EditableApplicationInputField =>
          Boolean(field),
      );

  if (
    ordered.length > 0
  ) {
    return ordered;
  }

  return Array.from(
    fieldMap.values(),
  );
}


function getAgreement(
  definition: unknown,
) {
  if (
    !definition ||
    typeof definition !==
      "object" ||
    Array.isArray(definition)
  ) {
    return "";
  }

  const agreement =
    (
      definition as Record<
        string,
        unknown
      >
    ).agreement;

  return typeof agreement ===
    "string"
    ? agreement
    : "";
}


export default function MyApplicationsPage() {
  const [
    deviceTimezone,
    setDeviceTimezone,
  ] =
    React.useState(
      "Asia/Tokyo",
    );


  React.useEffect(
    () => {
      setDeviceTimezone(
        getViewerTimezone(),
      );
    },
    [],
  );


  const [
    entries,
    setEntries,
  ] = React.useState<
    MyApplicationEntry[]
  >([]);

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  const [
    classes,
    setClasses,
  ] = React.useState<
    ParticipatingClass[]
  >([]);

  const [
    message,
    setMessage,
  ] = React.useState("");

  const [
    openEntryId,
    setOpenEntryId,
  ] = React.useState<
    string | null
  >(null);

  const [
    openMessageEntryId,
    setOpenMessageEntryId,
  ] = React.useState<
    string | null
  >(null);


  const [
    editingEntryId,
    setEditingEntryId,
  ] = React.useState<
    string | null
  >(null);

  const [
    editAnswers,
    setEditAnswers,
  ] = React.useState<
    Record<string, string>
  >({});

  const [
    savingEdit,
    setSavingEdit,
  ] = React.useState(false);

  const [
    editMessage,
    setEditMessage,
  ] = React.useState("");


  function startApplicationAnswerEdit(
    entry: MyApplicationEntry,
  ) {
    const fields =
      getApplicationInputFieldsForEntry(
        entry.application
          .definition,
      );

    const answerMap =
      new Map(
        entry.answers.map(
          (answer) => [
            answer.field_id,
            answer.value,
          ],
        ),
      );

    const next:
      Record<string, string> = {};

    for (
      const field of fields
    ) {
      const value =
        answerMap.get(
          field.id,
        );

      next[field.id] =
        typeof value === "string"
          ? value
          : value === null ||
              typeof value ===
                "undefined"
            ? ""
            : String(value);
    }

    setEditAnswers(next);
    setEditMessage("");
    setEditingEntryId(
      entry.id,
    );
  }


  function cancelApplicationAnswerEdit() {
    setEditingEntryId(null);
    setEditAnswers({});
    setEditMessage("");
  }


  function setApplicationEditAnswer(
    fieldId: string,
    value: string,
  ) {
    setEditAnswers(
      (current) => ({
        ...current,
        [fieldId]: value,
      }),
    );

    setEditMessage("");
  }


  async function saveApplicationAnswerEdit(
    entry: MyApplicationEntry,
  ) {
    if (!supabase) {
      setEditMessage(
        "ログイン情報を確認できませんでした。",
      );
      return;
    }

    setSavingEdit(true);
    setEditMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth
          .getSession();

      if (
        !session?.access_token
      ) {
        setEditMessage(
          "ログインが必要です。",
        );
        return;
      }

      const response =
        await fetch(
          "/api/application/my-entries",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                entryId:
                  entry.id,

                answers:
                  editAnswers,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              answers?: Answer[];
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        setEditMessage(
          result?.message ||
            "申込内容を変更できませんでした。",
        );
        return;
      }

      setEntries(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              entry.id
                ? {
                    ...item,
                    answers:
                      result.answers ??
                      item.answers,
                  }
                : item,
          ),
      );

      setEditingEntryId(null);
      setEditAnswers({});
      setEditMessage("");
    } catch (error) {
      console.error(
        "application answer edit failed:",
        error,
      );

      setEditMessage(
        "申込内容を変更できませんでした。",
      );
    } finally {
      setSavingEdit(false);
    }
  }


  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        if (!supabase) {
          setMessage(
            "ログイン情報を確認できませんでした。",
          );

          return;
        }

        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (
          !session?.access_token
        ) {
          setMessage(
            "申し込み履歴を見るにはログインしてください。",
          );

          return;
        }

        const response =
          await fetch(
            "/api/application/my-entries",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | {
                ok?: boolean;

                entries?:
                  MyApplicationEntry[];

                message?: string;
              }
            | null;

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok
        ) {
          setMessage(
            result?.message ||
              "申し込み履歴を取得できませんでした。",
          );

          return;
        }

        setEntries(
          result.entries ??
            [],
        );


        try {
          const calendarResponse =
            await fetch(
              "/api/calendar/my",
              {
                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                cache:
                  "no-store",
              },
            );


          const calendarResult =
            (await calendarResponse
              .json()
              .catch(
                () => null,
              )) as
              | {
                  ok?: boolean;

                  classes?:
                    ParticipatingClass[];
                }
              | null;


          if (
            !cancelled &&
            calendarResponse.ok &&
            calendarResult?.ok
          ) {
            setClasses(
              calendarResult.classes ??
                [],
            );
          }
        } catch (calendarError) {
          console.error(
            "my participating classes load failed:",
            calendarError,
          );
        }
      } catch (error) {
        console.error(
          "my applications load failed:",
          error,
        );

        if (
          !cancelled
        ) {
          setMessage(
            "申し込み履歴を取得できませんでした。",
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);


    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* HEADER */}
          <MyAreaHeader title="申込" />

          {/* PRIMARY TABS */}
          <div className="mt-6">
            <MyPrimaryTabs active="applications" />
          </div>

          {/* PARTICIPATING CLASSES */}
          {!loading &&
          classes.length > 0 ? (
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="mb-4">
                <div className="text-sm font-bold text-neutral-950">
                  参加中
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  継続して参加しているクラスやイベントです。
                </p>
              </div>


              <div className="space-y-4">
                {classes.map(
                  (item) => (
                    <section
                      key={
                        item.schedule_id
                      }
                      className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-neutral-950">
                            {item.title}
                          </h2>

                          {item.location ? (
                            <div className="mt-1 text-sm text-neutral-500">
                              {item.location}
                            </div>
                          ) : null}
                        </div>


                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                          {item.auto_booking
                            ? "自動予約中"
                            : "参加中"}
                        </span>
                      </div>


                      {item.next_starts_at ? (
                        <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                          <div className="text-xs font-bold text-neutral-400">
                            次回
                          </div>


                          <div className="mt-1 text-sm font-bold text-neutral-950">
                            {formatDateTimeInTimezone(
                              item.next_starts_at,
                              item.timezone,
                            )}
                          </div>


                          <div className="mt-2 text-xs leading-6 text-neutral-500">
                            開催基準時間帯：
                            <span className="font-bold text-neutral-700">
                              {item.timezone ||
                                "Asia/Tokyo"}
                            </span>
                          </div>


                          {(item.timezone ||
                            "Asia/Tokyo") !==
                          deviceTimezone ? (
                            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                              <div className="text-xs font-bold text-amber-900">
                                ⚠ 開催基準時間帯とあなたの現地時間が異なります
                              </div>

                              <div className="mt-2 space-y-1 text-xs leading-6 text-amber-900">
                                <div>
                                  <span className="font-bold">
                                    開催基準時間：
                                  </span>

                                  {formatDateTimeInTimezone(
                                    item.next_starts_at,
                                    item.timezone ||
                                      "Asia/Tokyo",
                                  )}

                                  {" "}

                                  （
                                  {item.timezone ||
                                    "Asia/Tokyo"}
                                  ）
                                </div>


                                <div>
                                  <span className="font-bold">
                                    あなたの現地時間：
                                  </span>

                                  {formatDateTimeInTimezone(
                                    item.next_starts_at,
                                    deviceTimezone,
                                  )}

                                  {" "}

                                  （
                                  {deviceTimezone}
                                  ）
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 text-xs leading-6 text-neutral-400">
                              あなたの現地時間帯と同じです
                              （
                              {deviceTimezone}
                              ）
                            </div>
                          )}


                          <div className="mt-3 text-xs text-neutral-500">
                            今後の予約　
                            {item.reservation_count}
                            回
                          </div>
                        </div>
                      ) : null}


                      {item.next_occurrence_id ? (
                        <Link
                          href={`/calendar/${item.next_occurrence_id}`}
                          className="mt-5 inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                        >
                          参加内容を見る
                        </Link>
                      ) : null}
                    </section>
                  ),
                )}
              </div>
            </div>
          ) : null}


          {/* APPLICATIONS */}
          <div className="mx-auto mt-8 max-w-2xl">
            <div className="mb-6">
              <div className="text-sm font-bold text-neutral-950">
                自分の申し込み
              </div>

              <p className="mt-1 text-xs leading-6 text-neutral-500">
                これまでに申し込んだ内容を確認できます。
              </p>
            </div>

            {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <p className="text-sm text-neutral-500">
              申し込み履歴を読み込んでいます...
            </p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <p className="text-sm leading-7 text-neutral-600">
              {message}
            </p>

            <Link
              href="/login?returnTo=/my/applications"
              className="mt-5 inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white"
            >
              ログイン
            </Link>
          </div>
        ) : entries.length ===
          0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
            <div className="text-lg font-bold text-neutral-950">
              まだ申し込みはありません
            </div>

            <p className="mt-2 text-sm text-neutral-500">
              申し込んだAPPLICATIONがここに表示されます。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(
              (entry) => {
                const isOpen =
                  openEntryId ===
                  entry.id;

                const applicationFields =
                  getApplicationFields(
                    entry.application
                      .definition,
                  );

                const agreement =
                  getAgreement(
                    entry.application
                      .definition,
                  );


                const applicationInputFields =
                  getApplicationInputFieldsForEntry(
                    entry.application
                      .definition,
                  );

                const applicationAnswerMap =
                  new Map(
                    entry.answers.map(
                      (answer) => [
                        answer.field_id,
                        answer,
                      ],
                    ),
                  );

                const isEditingAnswers =
                  editingEntryId ===
                  entry.id;

                const canEditAnswers =
                  applicationInputFields.length >
                    0 &&
                  (
                    entry.status ===
                      "submitted" ||
                    entry.status ===
                      "confirmed"
                  );

                return (
                  <section
                    key={
                      entry.id
                    }
                    className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"
                  >
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-bold text-neutral-950">
                            {
                              entry
                                .application
                                .title
                            }
                          </h2>

                          <div className="mt-2 text-xs text-neutral-400">
                            {formatDateTime(
                              entry.created_at,
                            )}
                            {" "}
                            申込
                          </div>
                        </div>

                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                          {statusLabel(
                            entry.status,
                          )}
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMessageEntryId(
                              null,
                            );

                            setOpenEntryId(
                              isOpen
                                ? null
                                : entry.id,
                            );
                          }}
                          className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                        >
                          {isOpen
                            ? "閉じる"
                            : "申込内容を見る"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              openMessageEntryId ===
                              entry.id
                            ) {
                              setOpenMessageEntryId(
                                null,
                              );
                              return;
                            }

                            setOpenEntryId(
                              null,
                            );

                            setOpenMessageEntryId(
                              entry.id,
                            );
                          }}
                          className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
                        >
                          {openMessageEntryId ===
                          entry.id
                            ? "メッセージを閉じる"
                            : "主催者とのメッセージ"}
                        </button>
                      </div>
                    </div>

                    {openMessageEntryId ===
                    entry.id ? (
                      <div className="border-t border-neutral-100 bg-neutral-50 px-6 pb-6">
                        <ApplicationEntryMessagePanel
                          entryId={
                            entry.id
                          }
                          counterpartLabel="主催者"
                        />
                      </div>
                    ) : null}

                    {isOpen ? (
                      <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-6">
                        {entry
                          .application
                          .description ? (
                          <div>
                            <div className="text-xs font-bold text-neutral-400">
                              申し込んだ時の募集案内
                            </div>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                              {
                                entry
                                  .application
                                  .description
                              }
                            </p>
                          </div>
                        ) : null}

                        {applicationFields.length >
                        0 ? (
                          <div className="mt-6">
                            <div className="text-xs font-bold text-neutral-400">
                              募集内容
                            </div>

                            <div className="mt-3 space-y-3">
                              {applicationFields.map(
                                (
                                  field,
                                ) => (
                                  <div
                                    key={
                                      field.id
                                    }
                                  >
                                    <div className="text-xs font-bold text-neutral-500">
                                      {
                                        field.label
                                      }
                                    </div>

                                    <div className="mt-1 text-sm text-neutral-900">
                                      {formatValue(
                                        field.value,
                                      )}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {applicationInputFields.length >
                        0 ? (
                          <div className="mt-7 border-t border-neutral-200 pt-6">
                            <div className="text-xs font-bold text-neutral-400">
                              {isEditingAnswers
                                ? "APPLICATION回答を変更"
                                : "あなたのAPPLICATION回答"}
                            </div>

                            {isEditingAnswers ? (
                              <div className="mt-4 space-y-4">
                                {applicationInputFields.map(
                                  (
                                    field,
                                  ) => {
                                    const value =
                                      editAnswers[
                                        field.id
                                      ] ?? "";

                                    if (
                                      field.kind ===
                                        "radio" ||
                                      field.kind ===
                                        "select" ||
                                      field.kind ===
                                        "checkbox"
                                    ) {
                                      return (
                                        <div
                                          key={
                                            field.id
                                          }
                                          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                                        >
                                          <div className="text-sm font-bold text-neutral-900">
                                            {
                                              field.label
                                            }
                                          </div>

                                          <p className="mt-2 text-xs text-amber-800">
                                            このFIELDは現在編集できません。
                                          </p>
                                        </div>
                                      );
                                    }

                                    if (
                                      field.kind ===
                                      "textarea"
                                    ) {
                                      return (
                                        <label
                                          key={
                                            field.id
                                          }
                                          className="block"
                                        >
                                          <span className="text-xs font-bold text-neutral-500">
                                            {
                                              field.label
                                            }

                                            {field.required ? (
                                              <span className="ml-2 text-red-500">
                                                必須
                                              </span>
                                            ) : null}
                                          </span>

                                          <textarea
                                            rows={4}
                                            value={
                                              value
                                            }
                                            onChange={(
                                              event,
                                            ) =>
                                              setApplicationEditAnswer(
                                                field.id,
                                                event
                                                  .target
                                                  .value,
                                              )
                                            }
                                            className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
                                          />
                                        </label>
                                      );
                                    }

                                    const inputType =
                                      field.kind ===
                                      "email"
                                        ? "email"
                                        : field.kind ===
                                            "tel"
                                          ? "tel"
                                          : field.kind ===
                                              "date"
                                            ? "date"
                                            : field.kind ===
                                                "datetime"
                                              ? "datetime-local"
                                              : "text";

                                    return (
                                      <label
                                        key={
                                          field.id
                                        }
                                        className="block"
                                      >
                                        <span className="text-xs font-bold text-neutral-500">
                                          {
                                            field.label
                                          }

                                          {field.required ? (
                                            <span className="ml-2 text-red-500">
                                              必須
                                            </span>
                                          ) : null}
                                        </span>

                                        <input
                                          type={
                                            inputType
                                          }
                                          value={
                                            value
                                          }
                                          inputMode={
                                            field.kind ===
                                            "postalCode"
                                              ? "numeric"
                                              : undefined
                                          }
                                          onChange={(
                                            event,
                                          ) =>
                                            setApplicationEditAnswer(
                                              field.id,
                                              event
                                                .target
                                                .value,
                                            )
                                          }
                                          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                                        />
                                      </label>
                                    );
                                  },
                                )}

                                {editMessage ? (
                                  <p className="text-sm text-red-600">
                                    {
                                      editMessage
                                    }
                                  </p>
                                ) : null}

                                <div className="flex flex-wrap gap-2 pt-2">
                                  <button
                                    type="button"
                                    disabled={
                                      savingEdit
                                    }
                                    onClick={() =>
                                      saveApplicationAnswerEdit(
                                        entry,
                                      )
                                    }
                                    className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:opacity-40"
                                  >
                                    {savingEdit
                                      ? "保存中..."
                                      : "変更を保存"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      savingEdit
                                    }
                                    onClick={
                                      cancelApplicationAnswerEdit
                                    }
                                    className="rounded-full bg-neutral-200 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-300 disabled:opacity-40"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="mt-3 space-y-4">
                                  {applicationInputFields.map(
                                    (
                                      field,
                                    ) => {
                                      const answer =
                                        applicationAnswerMap.get(
                                          field.id,
                                        );

                                      return (
                                        <div
                                          key={
                                            field.id
                                          }
                                        >
                                          <div className="text-xs font-bold text-neutral-500">
                                            {
                                              field.label
                                            }
                                          </div>

                                          <div className="mt-1 text-sm text-neutral-950">
                                            {formatValue(
                                              answer
                                                ?.value ??
                                                null,
                                            )}
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>

                                {canEditAnswers ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startApplicationAnswerEdit(
                                        entry,
                                      )
                                    }
                                    className="mt-5 rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
                                  >
                                    申込内容を変更
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : entry.answers.length >
                          0 ? (
                          <div className="mt-7 border-t border-neutral-200 pt-6">
                            <div className="text-xs font-bold text-neutral-400">
                              あなたのAPPLICATION回答
                            </div>

                            <div className="mt-3 space-y-4">
                              {entry.answers.map(
                                (
                                  answer,
                                ) => (
                                  <div
                                    key={
                                      answer.field_id
                                    }
                                  >
                                    <div className="text-xs font-bold text-neutral-500">
                                      {
                                        answer.label
                                      }
                                    </div>

                                    <div className="mt-1 text-sm text-neutral-950">
                                      {formatValue(
                                        answer.value,
                                      )}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {entry.form_submission ? (
                          <div className="mt-7 border-t border-neutral-200 pt-6">
                            <div className="text-xs font-bold text-neutral-400">
                              あなたのFORM回答
                            </div>

                            <div className="mt-3 space-y-4">
                              {entry.form_submission.answers.map(
                                (
                                  answer,
                                ) => (
                                  <div
                                    key={
                                      answer.field_id
                                    }
                                  >
                                    <div className="text-xs font-bold text-neutral-500">
                                      {
                                        answer.label
                                      }
                                    </div>

                                    <div className="mt-1 text-sm text-neutral-950">
                                      {formatValue(
                                        answer.value,
                                      )}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {agreement ? (
                          <div className="mt-7 border-t border-neutral-200 pt-6">
                            <div className="text-xs font-bold text-neutral-400">
                              確認・同意事項
                            </div>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                              {
                                agreement
                              }
                            </p>

                            {entry.agreed_at ? (
                              <div className="mt-3 text-xs text-neutral-400">
                                同意日時：
                                {formatDateTime(
                                  entry.agreed_at,
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-7 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
                          APPLICATION version{" "}
                          {
                            entry.application_version
                          }
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              },
            )}
          </div>
        )}

            </div>
          </div>
        </main>
      );
      }
