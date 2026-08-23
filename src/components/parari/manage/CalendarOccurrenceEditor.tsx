// src/components/parari/manage/CalendarOccurrenceEditor.tsx
// 2026-08-22 JST
//
// PARARI CALENDAR
// 「この回だけ変更」

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


export type EditableCalendarOccurrence = {
  id: string;
  calendar_item_id: string;
  calendar_schedule_id:
    | string
    | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string;
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
    | null;
  fee_currency: string;
  status:
    | "scheduled"
    | "cancelled"
    | "completed";
};


type Props = {
  occurrence:
    EditableCalendarOccurrence;

  onClose:
    () => void;

  onSaved:
    (
      occurrence:
        EditableCalendarOccurrence,
    ) => void;

  onCancelled:
    (
      occurrence:
        EditableCalendarOccurrence,
    ) => void;
};


function pad2(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    "0",
  );
}


function getLocalParts(
  occurrence:
    EditableCalendarOccurrence,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          occurrence.timezone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      },
    );


  const map =
    new Map<
      string,
      string
    >();


  for (
    const part of
      formatter.formatToParts(
        new Date(
          occurrence.starts_at,
        ),
      )
  ) {
    if (
      part.type !==
      "literal"
    ) {
      map.set(
        part.type,
        part.value,
      );
    }
  }


  return {
    date: [
      map.get("year"),
      map.get("month"),
      map.get("day"),
    ].join("-"),

    time: `${pad2(
      Number(
        map.get("hour"),
      ),
    )}:${pad2(
      Number(
        map.get("minute"),
      ),
    )}`,
  };
}


export default function CalendarOccurrenceEditor({
  occurrence,
  onClose,
  onSaved,
  onCancelled,
}: Props) {
  const local =
    React.useMemo(
      () =>
        getLocalParts(
          occurrence,
        ),
      [
        occurrence,
      ],
    );


  const originalDuration =
    Math.max(
      1,
      Math.round(
        (
          new Date(
            occurrence.ends_at,
          ).getTime() -
          new Date(
            occurrence.starts_at,
          ).getTime()
        ) /
          60000,
      ),
    );


  const [
    date,
    setDate,
  ] =
    React.useState(
      local.date,
    );


  const [
    startTime,
    setStartTime,
  ] =
    React.useState(
      local.time,
    );


  const [
    durationMinutes,
    setDurationMinutes,
  ] =
    React.useState(
      String(
        originalDuration,
      ),
    );


  const [
    location,
    setLocation,
  ] =
    React.useState(
      occurrence.location ??
        "",
    );


  const [
    capacity,
    setCapacity,
  ] =
    React.useState(
      occurrence.capacity ===
        null
        ? ""
        : String(
            occurrence.capacity,
          ),
    );


  const [
    minimumCapacity,
    setMinimumCapacity,
  ] =
    React.useState(
      occurrence
        .minimum_capacity ===
        null
        ? ""
        : String(
            occurrence
              .minimum_capacity,
          ),
    );


  const [
    feeAmount,
    setFeeAmount,
  ] =
    React.useState(
      occurrence.fee_amount ===
        null
        ? ""
        : String(
            occurrence.fee_amount,
          ),
    );


  const [
    saving,
    setSaving,
  ] =
    React.useState(false);


  const [
    message,
    setMessage,
  ] =
    React.useState("");


  async function cancelOccurrence() {
    if (saving) {
      return;
    }


    const confirmed =
      window.confirm(
        "この開催回だけ休講にしますか？\nほかの開催回には影響しません。",
      );


    if (!confirmed) {
      return;
    }


    setSaving(true);
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
        setMessage(
          "ログイン情報を確認できませんでした。",
        );

        return;
      }


      const response =
        await fetch(
          "/api/calendar/occurrences/cancel",
          {
            method:
              "PATCH",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                occurrenceId:
                  occurrence.id,
              }),
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
        !result.occurrence
      ) {
        setMessage(
          result?.message ??
            "休講にできませんでした。",
        );

        return;
      }


      onCancelled(
        result.occurrence,
      );
    } catch (error) {
      console.error(
        "[CalendarOccurrenceEditor] cancel failed:",
        error,
      );

      setMessage(
        "休講にできませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }


  async function save() {
    if (saving) {
      return;
    }


    setSaving(true);
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
        setMessage(
          "ログイン情報を確認できませんでした。",
        );

        return;
      }


      const response =
        await fetch(
          "/api/calendar/occurrences/update",
          {
            method:
              "PATCH",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                occurrenceId:
                  occurrence.id,

                date,

                startTime,

                durationMinutes,

                location,

                capacity,

                minimumCapacity,

                feeAmount,
              }),
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
        !result.occurrence
      ) {
        setMessage(
          result?.message ??
            "開催回を変更できませんでした。",
        );

        return;
      }


      onSaved(
        result.occurrence,
      );
    } catch (error) {
      console.error(
        "[CalendarOccurrenceEditor] save failed:",
        error,
      );


      setMessage(
        "開催回を変更できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <section className="mt-5 rounded-3xl border border-neutral-300 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
            ONE OCCURRENCE
          </div>

          <h3 className="mt-2 text-lg font-bold text-neutral-950">
            {
              occurrence.title
            }
            を、この回だけ変更
          </h3>

          <p className="mt-2 text-xs leading-5 text-neutral-500">
            毎週・隔週・毎月などの開催設定そのものは変更されません。
          </p>
        </div>


        <button
          type="button"
          onClick={
            onClose
          }
          className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-500"
        >
          閉じる
        </button>
      </div>


      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            開催日
          </div>

          <input
            type="date"
            value={
              date
            }
            onChange={(
              event,
            ) =>
              setDate(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            開始時刻
          </div>

          <input
            type="time"
            value={
              startTime
            }
            onChange={(
              event,
            ) =>
              setStartTime(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            所要時間（分）
          </div>

          <input
            type="number"
            min="1"
            value={
              durationMinutes
            }
            onChange={(
              event,
            ) =>
              setDurationMinutes(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            会場
          </div>

          <input
            type="text"
            value={
              location
            }
            onChange={(
              event,
            ) =>
              setLocation(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            定員
          </div>

          <input
            type="number"
            min="1"
            value={
              capacity
            }
            onChange={(
              event,
            ) =>
              setCapacity(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            最低開催人数
          </div>

          <input
            type="number"
            min="1"
            value={
              minimumCapacity
            }
            onChange={(
              event,
            ) =>
              setMinimumCapacity(
                event.target
                  .value,
              )
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </label>


        <label className="block">
          <div className="text-xs font-bold text-neutral-600">
            料金
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={
                feeAmount
              }
              onChange={(
                event,
              ) =>
                setFeeAmount(
                  event.target
                    .value,
                )
              }
              className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            />

            <div className="text-xs font-bold text-neutral-500">
              {
                occurrence.fee_currency
              }
            </div>
          </div>
        </label>


        <div>
          <div className="text-xs font-bold text-neutral-600">
            タイムゾーン
          </div>

          <div className="mt-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-500">
            {
              occurrence.timezone
            }
          </div>
        </div>
      </div>


      {message ? (
        <div className="mt-5 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {message}
        </div>
      ) : null}


      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={
            saving
          }
          onClick={() => {
            void cancelOccurrence();
          }}
          className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          この回を休講
        </button>


        <button
          type="button"
          disabled={
            saving
          }
          onClick={() => {
            void save();
          }}
          className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving
            ? "処理しています..."
            : "この回だけ保存"}
        </button>
      </div>
    </section>
  );
}
