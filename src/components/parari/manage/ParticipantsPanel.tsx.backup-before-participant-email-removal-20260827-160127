// src/components/parari/manage/ParticipantsPanel.tsx
// 2026-08-23 JST
//
// PARARI 共通参加者パネル
//
// occurrenceId:
//   CALENDAR の1開催回に絞った参加者
//
// applicationId:
//   APPLICATION 全体の申込者
//
// WHOのSSOTは application_entries。
// CALENDAR / APPLICATION は入口だけが異なる。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type EntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";


type ParticipantRow = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  status: EntryStatus;
  autoBooking: boolean;
  createdAt: string;
};


type CalendarOccurrence = {
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


type Props = {
  occurrenceId?: string;
  applicationId?: string;
  title?: string;
  onClose?: () => void;
};


function getStatusLabel(
  status: EntryStatus,
) {
  switch (status) {
    case "confirmed":
      return "参加確定";

    case "submitted":
      return "承認待ち";

    case "rejected":
      return "不承認";

    case "withdrawn":
      return "取消";

    case "cancelled":
      return "キャンセル";
  }
}


function getStatusClass(
  status: EntryStatus,
) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700";

    case "submitted":
      return "bg-amber-50 text-amber-700";

    case "rejected":
      return "bg-neutral-100 text-neutral-600";

    case "withdrawn":
    case "cancelled":
      return "bg-red-50 text-red-600";
  }
}


function formatOccurrenceDate(
  occurrence: CalendarOccurrence,
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


export default function ParticipantsPanel({
  occurrenceId,
  applicationId,
  title,
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
    participants,
    setParticipants,
  ] =
    React.useState<
      ParticipantRow[]
    >([]);

  const [
    occurrence,
    setOccurrence,
  ] =
    React.useState<
      CalendarOccurrence | null
    >(null);

  const [
    capacity,
    setCapacity,
  ] =
    React.useState<
      number | null
    >(null);


  React.useEffect(
    () => {
      let cancelled =
        false;


      async function load() {
        setLoading(true);
        setMessage("");
        setParticipants([]);
        setOccurrence(null);
        setCapacity(null);


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
                "参加者を見るにはログインが必要です。",
              );
            }

            return;
          }


          /*
           * CALENDAR:
           * 1開催回だけを見る。
           */
          if (occurrenceId) {
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
              await response
                .json()
                .catch(
                  () => null,
                );


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


            if (cancelled) {
              return;
            }


            const nextOccurrence =
              result
                .occurrence ??
              null;


            setOccurrence(
              nextOccurrence,
            );


            setCapacity(
              nextOccurrence
                ?.capacity ??
                null,
            );


            setParticipants(
              Array.isArray(
                result.participants,
              )
                ? result.participants.map(
                    (
                      participant: any,
                    ) => ({
                      id:
                        String(
                          participant
                            .entry_id,
                        ),

                      name:
                        String(
                          participant
                            .name ??
                            "参加者",
                        ),

                      email:
                        null,

                      username:
                        participant
                          .username ??
                        null,

                      status:
                        participant
                          .status,

                      autoBooking:
                        Boolean(
                          participant
                            .auto_booking,
                        ),

                      createdAt:
                        String(
                          participant
                            .created_at ??
                            "",
                        ),
                    }),
                  )
                : [],
            );


            return;
          }


          /*
           * APPLICATION:
           * APPLICATION全体を見る。
           *
           * 詳細なFORM回答・承認・支払い管理は
           * 従来のApplicationManager側に残す。
           */
          if (applicationId) {
            const response =
              await fetch(
                `/api/application/entries?applicationId=${encodeURIComponent(
                  applicationId,
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
              await response
                .json()
                .catch(
                  () => null,
                );


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


            if (cancelled) {
              return;
            }


            setParticipants(
              Array.isArray(
                result.entries,
              )
                ? result.entries.map(
                    (
                      entry: any,
                    ) => {
                      const applicant =
                        entry
                          .applicant ??
                        {};


                      return {
                        id:
                          String(
                            entry.id,
                          ),

                        name:
                          String(
                            applicant
                              .display_name ||
                              applicant
                                .username ||
                              applicant
                                .email ||
                              "参加者",
                          ),

                        email:
                          applicant
                            .email ??
                          null,

                        username:
                          applicant
                            .username ??
                          null,

                        status:
                          entry.status,

                        autoBooking:
                          false,

                        createdAt:
                          String(
                            entry
                              .created_at ??
                              "",
                          ),
                      };
                    },
                  )
                : [],
            );


            return;
          }


          if (!cancelled) {
            setMessage(
              "参加者情報が指定されていません。",
            );
          }
        } catch (error) {
          console.error(
            "[ParticipantsPanel] load failed:",
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
      applicationId,
    ],
  );


  const currentParticipants =
    participants.filter(
      (participant) =>
        participant.status ===
          "confirmed" ||
        participant.status ===
          "submitted",
    );


  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
            PARTICIPANTS
          </div>

          <div className="mt-1 text-lg font-bold text-neutral-950">
            参加者
          </div>

          {title ? (
            <div className="mt-1 text-sm font-bold text-neutral-700">
              {
                title
              }
            </div>
          ) : null}


          {occurrence ? (
            <>
              <div className="mt-1 text-sm font-bold text-neutral-700">
                {
                  occurrence.title
                }
              </div>

              <div className="mt-1 text-xs text-neutral-500">
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


        {onClose ? (
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
          >
            閉じる
          </button>
        ) : null}
      </div>


      {!loading &&
      !message ? (
        <div className="mt-4 text-sm font-bold text-neutral-900">
          参加者{" "}
          {
            currentParticipants.length
          }
          名
          {capacity !==
          null ? (
            <>
              {" "}
              / 定員{" "}
              {
                capacity
              }
              名
            </>
          ) : null}
        </div>
      ) : null}


      {loading ? (
        <div className="mt-4 text-sm text-neutral-500">
          参加者を読み込んでいます...
        </div>
      ) : null}


      {message ? (
        <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {
            message
          }
        </div>
      ) : null}


      {!loading &&
      !message &&
      participants.length ===
        0 ? (
        <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
          まだ参加者はいません。
        </div>
      ) : null}


      {!loading &&
      !message &&
      participants.length >
        0 ? (
        <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {participants.map(
            (
              participant,
            ) => (
              <div
                key={
                  participant.id
                }
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-neutral-950">
                    {
                      participant.name
                    }
                  </div>

                  {participant.email ? (
                    <div className="mt-0.5 truncate text-xs text-neutral-400">
                      {
                        participant.email
                      }
                    </div>
                  ) : participant.username ? (
                    <div className="mt-0.5 truncate text-xs text-neutral-400">
                      @
                      {
                        participant.username
                      }
                    </div>
                  ) : null}
                </div>


                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {participant.autoBooking ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                      自動予約
                    </span>
                  ) : null}

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${getStatusClass(
                      participant.status,
                    )}`}
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
      ) : null}
    </section>
  );
}
