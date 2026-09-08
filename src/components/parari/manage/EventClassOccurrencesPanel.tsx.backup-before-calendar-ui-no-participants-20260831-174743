// src/components/parari/manage/EventClassOccurrencesPanel.tsx
// 2026-08-23 JST
//
// イベント・クラスに属する「今後の開催回」を一覧表示する。
// 開催回そのものの編集UIはここには持たない。
// 選択された開催回は EventClassManagementPanel に返し、
// 親パネル全体を occurrence context に切り替える。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


export type EventClassOccurrence = {
  id: string;
  calendar_item_id: string;
  calendar_schedule_id: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string;
  location: string | null;
  capacity: number | null;
  reservation_count?: number;
  minimum_capacity: number | null;
  fee_amount: number | null;
  fee_currency: string;
  status:
    | "scheduled"
    | "cancelled"
    | "completed";
};


type Props = {
  calendarItemId: string;

  selectedOccurrenceId?:
    | string
    | null;

  onSelectOccurrence: (
    occurrence: EventClassOccurrence,
  ) => void;

  refreshKey?: number;
};


export function formatEventClassOccurrenceDateTime(
  occurrence: EventClassOccurrence,
) {
  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          occurrence.timezone,

        year:
          "numeric",

        month:
          "short",

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
      new Date(
        occurrence.starts_at,
      ),
    );
  } catch {
    return occurrence.starts_at;
  }
}


export default function EventClassOccurrencesPanel({
  calendarItemId,
  selectedOccurrenceId = null,
  onSelectOccurrence,
  refreshKey = 0,
}: Props) {
  const [
    occurrences,
    setOccurrences,
  ] =
    React.useState<
      EventClassOccurrence[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    React.useState(true);

  const [
    message,
    setMessage,
  ] =
    React.useState("");


  React.useEffect(
    () => {
      let cancelled =
        false;


      async function load() {
        setLoading(true);
        setMessage("");


        try {
          const {
            data: {
              session,
            },
          } =
            await supabase.auth
              .getSession();


          if (
            !session?.access_token
          ) {
            if (!cancelled) {
              setMessage(
                "開催予定を見るにはログインが必要です。",
              );
            }

            return;
          }


          const response =
            await fetch(
              "/api/calendar/occurrences",
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
            await response
              .json()
              .catch(
                () => null,
              );


          if (cancelled) {
            return;
          }


          if (
            !response.ok ||
            !result?.ok
          ) {
            setMessage(
              result?.message ??
                "開催予定を取得できませんでした。",
            );

            return;
          }


          const rows =
            Array.isArray(
              result.occurrences,
            )
              ? result.occurrences
              : [];


          const now =
            Date.now();


          setOccurrences(
            rows
              .filter(
                (
                  occurrence: EventClassOccurrence,
                ) =>
                  occurrence
                    .calendar_item_id ===
                    calendarItemId &&
                  new Date(
                    occurrence.ends_at,
                  ).getTime() >=
                    now,
              )
              .sort(
                (
                  a: EventClassOccurrence,
                  b: EventClassOccurrence,
                ) =>
                  new Date(
                    a.starts_at,
                  ).getTime() -
                  new Date(
                    b.starts_at,
                  ).getTime(),
              ),
          );
        } catch (error) {
          console.error(
            "[EventClassOccurrencesPanel] load failed:",
            error,
          );


          if (!cancelled) {
            setMessage(
              "開催予定を取得できませんでした。",
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
        cancelled =
          true;
      };
    },
    [
      calendarItemId,
      refreshKey,
    ],
  );


  if (loading) {
    return (
      <p className="text-sm text-neutral-500">
        開催予定を読み込んでいます...
      </p>
    );
  }


  if (message) {
    return (
      <p className="text-sm text-neutral-600">
        {
          message
        }
      </p>
    );
  }


  if (
    occurrences.length ===
    0
  ) {
    return (
      <div className="rounded-2xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
        今後の開催予定はありません。
      </div>
    );
  }


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-neutral-500">
          今後の開催予定{" "}
          <strong className="text-neutral-800">
            {
              occurrences.length
            }
          </strong>
          {" "}
          回
        </div>

        {selectedOccurrenceId ? (
          <div className="text-xs font-bold text-neutral-400">
            別の開催回を選択できます
          </div>
        ) : null}
      </div>


      {occurrences.map(
        (
          occurrence,
        ) => {
          const selected =
            selectedOccurrenceId ===
            occurrence.id;


          return (
            <button
              key={
                occurrence.id
              }
              type="button"
              onClick={() => {
                onSelectOccurrence(
                  occurrence,
                );
              }}
              className={
                selected
                  ? "block w-full rounded-2xl border border-neutral-950 bg-neutral-50 p-4 text-left"
                  : occurrence.status ===
                      "cancelled"
                    ? "block w-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left opacity-70 transition hover:border-neutral-400"
                    : "block w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400"
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-neutral-950">
                    {formatEventClassOccurrenceDateTime(
                      occurrence,
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    {occurrence.location ? (
                      <span>
                        {
                          occurrence.location
                        }
                      </span>
                    ) : null}

                    <span>
                      参加者{" "}
                      {
                        occurrence.reservation_count ??
                        0
                      }
                      {occurrence.capacity !==
                      null
                        ? ` / ${occurrence.capacity}`
                        : ""}
                    </span>

                    {occurrence.status ===
                    "cancelled" ? (
                      <span className="font-bold text-red-600">
                        休講
                      </span>
                    ) : null}
                  </div>
                </div>


                <div className="shrink-0">
                  {selected ? (
                    <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-white">
                      選択中
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-neutral-400">
                      開く
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        },
      )}
    </div>
  );
}
