"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type Props = {
  calendarItemId: string;
};


type BookingDefinition = {
  calendarBooking?: {
    deadlineMinutesBefore?: number;
    recurringBookingEnabled?: boolean;
  };
};


type Booking = {
  id: string;

  status:
    | "draft"
    | "open"
    | "closed";

  acceptance_mode:
    | "instant"
    | "approval";

  definition:
    | BookingDefinition
    | null;
};


type DeadlineMode =
  | "start"
  | "hours"
  | "days";


export default function CalendarBookingSettingsEditor({
  calendarItemId,
}: Props) {
  const [
    loading,
    setLoading,
  ] =
    React.useState(true);

  const [
    saving,
    setSaving,
  ] =
    React.useState(false);

  const [
    enabled,
    setEnabled,
  ] =
    React.useState(false);

  const [
    acceptanceMode,
    setAcceptanceMode,
  ] =
    React.useState<
      "instant" | "approval"
    >("instant");

  const [
    deadlineMode,
    setDeadlineMode,
  ] =
    React.useState<
      DeadlineMode
    >("start");

  const [
    deadlineValue,
    setDeadlineValue,
  ] =
    React.useState("2");

  const [
    recurringBookingEnabled,
    setRecurringBookingEnabled,
  ] =
    React.useState(false);

  const [
    message,
    setMessage,
  ] =
    React.useState("");


  React.useEffect(() => {
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
          !session
            ?.access_token
        ) {
          if (!cancelled) {
            setMessage(
              "ログイン情報を確認できませんでした。",
            );
          }

          return;
        }

        const response =
          await fetch(
            `/api/calendar/bookings?calendarItemId=${encodeURIComponent(
              calendarItemId,
            )}`,
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
              "予約設定を取得できませんでした。",
          );

          return;
        }

        const booking =
          (
            Array.isArray(
              result.bookings,
            )
              ? result
                  .bookings[0]
              : null
          ) as
            | Booking
            | null;

        if (!booking) {
          /*
           * 初回の予約設定は受付ONを標準にする。
           *
           * OFFで設定だけ保存したい場合は、
           * ユーザーが明示的にOFFを選べる。
           */
          setEnabled(true);
          setAcceptanceMode(
            "instant",
          );
          setDeadlineMode(
            "start",
          );
          setDeadlineValue(
            "2",
          );
          setRecurringBookingEnabled(
            false,
          );

          return;
        }

        setEnabled(
          booking.status ===
            "open",
        );

        setAcceptanceMode(
          booking
            .acceptance_mode ===
            "approval"
            ? "approval"
            : "instant",
        );

        const minutes =
          Number(
            booking
              .definition
              ?.calendarBooking
              ?.deadlineMinutesBefore ??
              0,
          );

        if (
          Number.isFinite(
            minutes,
          ) &&
          minutes > 0
        ) {
          if (
            minutes %
              1440 ===
            0
          ) {
            setDeadlineMode(
              "days",
            );

            setDeadlineValue(
              String(
                minutes /
                  1440,
              ),
            );
          } else {
            setDeadlineMode(
              "hours",
            );

            setDeadlineValue(
              String(
                Math.max(
                  1,
                  Math.round(
                    minutes /
                      60,
                  ),
                ),
              ),
            );
          }
        } else {
          setDeadlineMode(
            "start",
          );
        }

        setRecurringBookingEnabled(
          booking
            .definition
            ?.calendarBooking
            ?.recurringBookingEnabled ===
            true,
        );
      } catch (error) {
        console.error(
          "[CalendarBookingSettingsEditor] load failed:",
          error,
        );

        if (!cancelled) {
          setMessage(
            "予約設定を取得できませんでした。",
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
      cancelled = true;
    };
  }, [
    calendarItemId,
  ]);


  function getDeadlineMinutes():
    number | null {
    if (
      deadlineMode ===
      "start"
    ) {
      return 0;
    }

    const value =
      Number(
        deadlineValue,
      );

    if (
      !Number.isInteger(
        value,
      ) ||
      value <= 0
    ) {
      return null;
    }

    return deadlineMode ===
      "days"
      ? value * 1440
      : value * 60;
  }


  async function save() {
    const deadlineMinutesBefore =
      getDeadlineMinutes();

    if (
      deadlineMinutesBefore ===
      null
    ) {
      setMessage(
        "予約締切の数字を確認してください。",
      );

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
        !session
          ?.access_token
      ) {
        setMessage(
          "ログイン情報を確認できませんでした。",
        );

        return;
      }

      const response =
        await fetch(
          "/api/calendar/bookings",
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                calendarItemId,
                enabled,
                acceptanceMode,
                deadlineMinutesBefore,
                recurringBookingEnabled,
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
        !result?.ok
      ) {
        setMessage(
          result?.message ??
            "予約設定を保存できませんでした。",
        );

        return;
      }

      setEnabled(
        result.booking
          ?.status ===
          "open",
      );

      setMessage(
        "予約設定を保存しました。",
      );
    } catch (error) {
      console.error(
        "[CalendarBookingSettingsEditor] save failed:",
        error,
      );

      setMessage(
        "予約設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <div className="text-sm text-neutral-500">
        予約設定を読み込んでいます...
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-bold text-neutral-950">
          予約受付
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              setEnabled(true)
            }
            className={
              enabled
                ? "rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                : "rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600"
            }
          >
            ON
          </button>

          <button
            type="button"
            onClick={() =>
              setEnabled(false)
            }
            className={
              !enabled
                ? "rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                : "rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600"
            }
          >
            OFF
          </button>
        </div>
      </div>


      <div className="border-t border-neutral-100 pt-5">
        <div className="text-sm font-bold text-neutral-950">
          受付方法
        </div>

        <label className="mt-3 flex items-start gap-3">
          <input
            type="radio"
            checked={
              acceptanceMode ===
              "instant"
            }
            onChange={() =>
              setAcceptanceMode(
                "instant",
              )
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              予約すると確定
            </span>

            <span className="mt-1 block text-xs text-neutral-500">
              参加者が予約すると、その場で予約確定になります。
            </span>
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3">
          <input
            type="radio"
            checked={
              acceptanceMode ===
              "approval"
            }
            onChange={() =>
              setAcceptanceMode(
                "approval",
              )
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              主催者の承認後に確定
            </span>

            <span className="mt-1 block text-xs text-neutral-500">
              予約申込みを確認してから参加を確定します。
            </span>
          </span>
        </label>
      </div>


      <div className="border-t border-neutral-100 pt-5">
        <div className="text-sm font-bold text-neutral-950">
          予約締切
        </div>

        <label className="mt-3 flex items-center gap-3">
          <input
            type="radio"
            checked={
              deadlineMode ===
              "start"
            }
            onChange={() =>
              setDeadlineMode(
                "start",
              )
            }
          />

          <span className="text-sm text-neutral-800">
            開催時刻まで
          </span>
        </label>

        <label className="mt-3 flex items-center gap-3">
          <input
            type="radio"
            checked={
              deadlineMode ===
              "hours"
            }
            onChange={() =>
              setDeadlineMode(
                "hours",
              )
            }
          />

          <span className="text-sm">
            開催
          </span>

          <input
            type="number"
            min={1}
            step={1}
            value={
              deadlineMode ===
              "hours"
                ? deadlineValue
                : "2"
            }
            onChange={(event) => {
              setDeadlineMode(
                "hours",
              );

              setDeadlineValue(
                event.target.value,
              );
            }}
            className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />

          <span className="text-sm">
            時間前
          </span>
        </label>

        <label className="mt-3 flex items-center gap-3">
          <input
            type="radio"
            checked={
              deadlineMode ===
              "days"
            }
            onChange={() =>
              setDeadlineMode(
                "days",
              )
            }
          />

          <span className="text-sm">
            開催
          </span>

          <input
            type="number"
            min={1}
            step={1}
            value={
              deadlineMode ===
              "days"
                ? deadlineValue
                : "1"
            }
            onChange={(event) => {
              setDeadlineMode(
                "days",
              );

              setDeadlineValue(
                event.target.value,
              );
            }}
            className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />

          <span className="text-sm">
            日前
          </span>
        </label>
      </div>


      <div className="border-t border-neutral-100 pt-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={
              recurringBookingEnabled
            }
            onChange={(event) =>
              setRecurringBookingEnabled(
                event.target.checked,
              )
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              継続予約を許可する
            </span>

            <span className="mt-1 block text-xs text-neutral-500">
              定期クラスでは毎週・隔週・毎月の継続予約を選べるようにします。
            </span>
          </span>
        </label>
      </div>


      <div className="border-t border-neutral-100 pt-5">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void save();
          }}
          className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving
            ? "保存しています..."
            : "予約設定を保存"}
        </button>

        {message ? (
          <p className="mt-3 text-sm text-neutral-600">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
