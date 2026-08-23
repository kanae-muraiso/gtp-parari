// src/components/parari/manage/CalendarOccurrenceParticipants.tsx
// 2026-08-23 JST
//
// 作者専用
// 1開催回の参加者一覧。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type Participant = {
  entry_id: string;
  user_id: string;
  name: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  status:
    | "submitted"
    | "confirmed"
    | "rejected";
  auto_booking: boolean;
  created_at: string;
};


type Occurrence = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string | null;
  capacity: number | null;
  status:
    | "scheduled"
    | "cancelled"
    | "completed";
};


type ResponseData = {
  ok: boolean;
  message?: string;
  occurrence?: Occurrence;
  acceptance_mode?:
    | "instant"
    | "approval"
    | null;
  reservation_count?: number;
  participants?: Participant[];
};


type Props = {
  occurrenceId: string;
  onClose: () => void;
};


function getStatusLabel(
  status: Participant["status"],
) {
  switch (status) {
    case "confirmed":
      return "予約確定";

    case "submitted":
      return "承認待ち";

    case "rejected":
      return "不承認";
  }
}


function formatOccurrenceDate(
  occurrence: Occurrence,
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
          "long",
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


export default function CalendarOccurrenceParticipants({
  occurrenceId,
  onClose,
}: Props) {
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

  const [
    data,
    setData,
  ] =
    React.useState<
      ResponseData | null
    >(null);


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


          const accessToken =
            session
              ?.access_token ??
            null;


          if (!accessToken) {
            if (!cancelled) {
              setMessage(
                "参加者を確認するにはログインしてください。",
              );
            }

            return;
          }


          const response =
            await fetch(
              `/api/calendar/occurrences/participants?occurrenceId=${encodeURIComponent(
                occurrenceId,
              )}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
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
              | ResponseData
              | null;


          if (
            !response.ok ||
            !result?.ok
          ) {
            if (!cancelled) {
              setMessage(
                result
                  ?.message ??
                  "参加者を取得できませんでした。",
              );
            }

            return;
          }


          if (!cancelled) {
            setData(
              result,
            );
          }
        } catch (error) {
          console.error(
            "[CalendarOccurrenceParticipants] load failed:",
            error,
          );

          if (!cancelled) {
            setMessage(
              "参加者を取得できませんでした。",
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
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
      occurrenceId,
    ],
  );


  const occurrence =
    data?.occurrence ??
    null;

  const participants =
    Array.isArray(
      data?.participants,
    )
      ? data.participants
      : [];

  const reservationCount =
    Number(
      data?.reservation_count ??
        participants.length,
    );


  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.12em] text-neutral-500">
            参加者
          </div>

          {occurrence ? (
            <>
              <div className="mt-1 text-base font-bold text-neutral-950">
                {
                  occurrence.title
                }
              </div>

              <div className="mt-1 text-xs text-neutral-600">
                {formatOccurrenceDate(
                  occurrence,
                )}
              </div>

              {occurrence.location ? (
                <div className="mt-1 text-xs text-neutral-500">
                  {
                    occurrence.location
                  }
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
        >
          閉じる
        </button>
      </div>


      {loading ? (
        <div className="mt-4 text-sm text-neutral-500">
          参加者を読み込んでいます…
        </div>
      ) : null}


      {message ? (
        <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {
            message
          }
        </div>
      ) : null}


      {!loading &&
      !message &&
      occurrence ? (
        <>
          <div className="mt-4 flex items-center gap-2">
            <div className="text-lg font-bold text-neutral-950">
              予約 {
                reservationCount
              }
              {
                occurrence.capacity !==
                null
                  ? ` / ${occurrence.capacity}`
                  : ""
              }
            </div>

            {data?.acceptance_mode ===
            "approval" ? (
              <div className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                承認制
              </div>
            ) : null}
          </div>


          {participants.length ===
          0 ? (
            <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
              まだ予約者はいません。
            </div>
          ) : (
            <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {participants.map(
                (
                  participant,
                ) => (
                  <div
                    key={
                      participant.entry_id
                    }
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-neutral-950">
                        {
                          participant.name
                        }
                      </div>

                      {participant.username ? (
                        <div className="mt-0.5 truncate text-xs text-neutral-400">
                          @
                          {
                            participant.username
                          }
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {participant.auto_booking ? (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                          自動予約
                        </span>
                      ) : null}

                      <span
                        className={
                          participant.status ===
                          "confirmed"
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                            : participant.status ===
                                "submitted"
                              ? "rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"
                              : "rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600"
                        }
                      >
                        {getStatusLabel(
                          participant.status,
                        )}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
