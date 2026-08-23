// src/app/my/applications/page.tsx
// 2026/08/16 12:56

"use client";

import * as React from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";

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

  form_submission: {
    id: string;

    submitted_at:
      | string
      | null;

    form_snapshot: unknown;

    answers: Answer[];
  } | null;
};


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
    message,
    setMessage,
  ] = React.useState("");

  const [
    openEntryId,
    setOpenEntryId,
  ] = React.useState<
    string | null
  >(null);


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

                      <button
                        type="button"
                        onClick={() =>
                          setOpenEntryId(
                            isOpen
                              ? null
                              : entry.id,
                          )
                        }
                        className="mt-5 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                      >
                        {isOpen
                          ? "閉じる"
                          : "申込内容を見る"}
                      </button>
                    </div>

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
