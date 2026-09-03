// src/app/calendar/[occurrenceId]/page.tsx
// PARARI CALENDAR
// 公開開催回ページ
//
// /calendar/{occurrenceId}
//
// CALENDARは開催情報だけを表示する。
// 参加・申込はAPPLICATIONが担当する。

"use client";

import * as React from "react";
import Link from "next/link";
import {
  useParams,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabaseClient";

type PublicOccurrence = {
  id: string;
  title:
    | string
    | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location:
    | string
    | null;
  capacity:
    | number
    | null;
  minimum_capacity:
    | number
    | null;
  fee_amount:
    | number
    | string
    | null;
  fee_currency: string;
  status: string;
  description_work_id:
    | string
    | null;
};

type OrganizerParticipant = {
  entry_id: string;
  application_id: string;
  user_id:
    | string
    | null;
  username:
    | string
    | null;
  display_name:
    | string
    | null;
};

type OrganizerParticipation = {
  confirmed_count: number;
  approval_required: boolean;
  submitted_count: number;
  participants:
    OrganizerParticipant[];
};

type PageData = {
  participation:
    | OrganizerParticipation
    | null;
  occurrence:
    PublicOccurrence;
  organizer: {
    username:
      | string
      | null;
    display_name:
      | string
      | null;
  };
};

function formatDateTime(
  value: string,
  timezone: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          timezone,
        year:
          "numeric",
        month:
          "long",
        day:
          "numeric",
        weekday:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
      },
    ).format(
      new Date(
        value,
      ),
    );
  } catch {
    return value;
  }
}

function formatTime(
  value: string,
  timezone: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          timezone,
        hour:
          "2-digit",
        minute:
          "2-digit",
      },
    ).format(
      new Date(
        value,
      ),
    );
  } catch {
    return value;
  }
}

function getFeeLabel(
  amount:
    | number
    | string
    | null,
  currency: string,
) {
  if (amount === null) {
    return null;
  }

  const value =
    Number(
      amount,
    );

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value === 0) {
    return "無料";
  }

  if (currency === "JPY") {
    return `${value.toLocaleString(
      "ja-JP",
    )}円`;
  }

  return `${value.toLocaleString()} ${currency}`;
}

function getStatusLabel(
  status: string,
) {
  if (status === "cancelled") {
    return "休講・中止";
  }

  if (status === "completed") {
    return "開催済み";
  }

  return "開催予定";
}

export default function CalendarOccurrencePage() {
  const params =
    useParams();

  const occurrenceId =
    String(
      (
        params as {
          occurrenceId?: string;
        }
      )?.occurrenceId ??
        "",
    ).trim();

  const [
    data,
    setData,
  ] =
    React.useState<
      PageData | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );

  const [
    message,
    setMessage,
  ] =
    React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!occurrenceId) {
        if (!cancelled) {
          setData(null);

          setMessage(
            "開催回が指定されていません。",
          );

          setLoading(
            false,
          );
        }

        return;
      }

      setLoading(
        true,
      );

      setMessage("");

      try {
        const session =
          supabase
            ? (
                await supabase.auth
                  .getSession()
              ).data.session
            : null;

        const response =
          await fetch(
            `/api/calendar/public?occurrenceId=${encodeURIComponent(
              occurrenceId,
            )}`,
            {
              method:
                "GET",
              headers:
                session?.access_token
                  ? {
                      Authorization:
                        `Bearer ${session.access_token}`,
                    }
                  : undefined,
              cache:
                "no-store",
            },
          );

        const result =
          await response
            .json()
            .catch(
              () => null,
            );

        if (
          !response.ok ||
          !result?.ok ||
          !result?.occurrence
        ) {
          if (!cancelled) {
            setData(null);

            setMessage(
              result?.message ??
                "開催情報を取得できませんでした。",
            );
          }

          return;
        }

        let participation:
          | OrganizerParticipation
          | null =
            null;

        if (
          session?.access_token
        ) {
          const participationResponse =
            await fetch(
              `/api/application/occurrence-participants?occurrenceId=${encodeURIComponent(
                occurrenceId,
              )}`,
              {
                method:
                  "GET",
                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },
                cache:
                  "no-store",
              },
            );

          const participationResult =
            await participationResponse
              .json()
              .catch(
                () => null,
              );

          if (
            participationResponse.ok &&
            participationResult?.ok &&
            participationResult
              ?.participation
          ) {
            participation =
              participationResult
                .participation;
          }
        }

        if (!cancelled) {
          setData({
            participation,
            occurrence:
              result.occurrence,
            organizer:
              result.organizer ?? {
                username:
                  null,
                display_name:
                  null,
              },
          });
        }
      } catch (error) {
        console.error(
          "[calendar occurrence page] load failed:",
          error,
        );

        if (!cancelled) {
          setData(null);

          setMessage(
            "開催情報を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    occurrenceId,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-neutral-500">
          開催情報を読み込んでいます...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
            <div className="font-bold text-neutral-900">
              開催情報を表示できません
            </div>

            {message ? (
              <div className="mt-3 text-sm text-neutral-500">
                {
                  message
                }
              </div>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const {
    occurrence,
    organizer,
    participation,
  } = data;

  const feeLabel =
    getFeeLabel(
      occurrence.fee_amount,
      occurrence.fee_currency,
    );

  const organizerName =
    organizer.display_name ||
    organizer.username ||
    null;

  const statusLabel =
    getStatusLabel(
      occurrence.status,
    );

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="mb-4 text-xs font-bold tracking-[0.18em] text-neutral-400">
          PARARI CALENDAR
        </div>

        <article className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-6 sm:p-9">
            {occurrence.status ===
            "cancelled" ? (
              <div className="mb-6 rounded-2xl border border-neutral-300 bg-neutral-100 px-5 py-4">
                <div className="text-sm font-bold text-neutral-900">
                  この開催回は休講・中止になりました。
                </div>
              </div>
            ) : null}

            <h1 className="text-2xl font-bold leading-tight text-neutral-950 sm:text-3xl">
              {
                occurrence.title
                  ?.trim() ||
                "開催情報"
              }
            </h1>

            {organizerName ? (
              <div className="mt-3 text-sm text-neutral-500">
                主催：{" "}
                {
                  organizerName
                }
              </div>
            ) : null}

            <div className="mt-6">
              <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">
                {
                  statusLabel
                }
              </span>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <div className="text-xs font-bold text-neutral-400">
                  日時
                </div>

                <div className="mt-1 text-base font-bold text-neutral-900">
                  {formatDateTime(
                    occurrence.starts_at,
                    occurrence.timezone,
                  )}
                  {" 〜 "}
                  {formatTime(
                    occurrence.ends_at,
                    occurrence.timezone,
                  )}
                </div>

                <div className="mt-1 text-xs text-neutral-400">
                  {
                    occurrence.timezone
                  }
                </div>
              </div>

              {occurrence.location?.trim() ? (
                <div>
                  <div className="text-xs font-bold text-neutral-400">
                    会場
                  </div>

                  <div className="mt-1 text-base text-neutral-800">
                    {
                      occurrence.location
                    }
                  </div>
                </div>
              ) : null}

              {feeLabel ? (
                <div>
                  <div className="text-xs font-bold text-neutral-400">
                    料金
                  </div>

                  <div className="mt-1 text-base text-neutral-800">
                    {
                      feeLabel
                    }
                  </div>
                </div>
              ) : null}

              {occurrence.capacity !==
              null ? (
                <div>
                  <div className="text-xs font-bold text-neutral-400">
                    定員
                  </div>

                  <div className="mt-1 text-base text-neutral-800">
                    {
                      occurrence.capacity
                    }
                    名
                  </div>
                </div>
              ) : null}

              {occurrence.minimum_capacity ? (
                <div>
                  <div className="text-xs font-bold text-neutral-400">
                    最低開催人数
                  </div>

                  <div className="mt-1 text-base text-neutral-800">
                    {
                      occurrence.minimum_capacity
                    }
                    名
                  </div>
                </div>
              ) : null}
            </div>

            {participation ? (
              <div className="mt-8 border-t border-neutral-100 pt-6">
                <div className="text-base font-bold text-neutral-950">
                  参加状況
                </div>

                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                  <div>
                    参加予定{" "}
                    <span className="font-bold text-neutral-950">
                      {
                        participation.confirmed_count
                      }
                      名
                    </span>
                  </div>

                  {participation.approval_required ? (
                    <div>
                      承認待ち{" "}
                      <span className="font-bold text-neutral-950">
                        {
                          participation.submitted_count
                        }
                        名
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6">
                  <div className="text-sm font-bold text-neutral-900">
                    参加者
                  </div>

                  {participation
                    .participants
                    .length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {participation
                        .participants
                        .map(
                          (
                            participant,
                          ) => {
                            const name =
                              participant
                                .display_name ||
                              participant
                                .username ||
                              "名前未設定";

                            return (
                              <div
                                key={
                                  participant
                                    .entry_id
                                }
                                className="text-sm text-neutral-700"
                              >
                                {name}
                              </div>
                            );
                          },
                        )}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-neutral-500">
                      参加予定者はいません。
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {occurrence.description_work_id ? (
              <div className="mt-8 border-t border-neutral-100 pt-6">
                <Link
                  href={`/p/${occurrence.description_work_id}`}
                  className="text-sm font-bold text-neutral-700 underline underline-offset-4"
                >
                  クラス・イベントの詳しい説明を見る
                </Link>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}
