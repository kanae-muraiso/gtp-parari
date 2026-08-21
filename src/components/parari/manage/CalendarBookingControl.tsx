// src/components/parari/manage/CalendarBookingControl.tsx
// 2026-08-20 JST
//
// CALENDAR item の予約受付ON/OFF。
//
// booking APPLICATIONは
// CALENDARからだけ自動生成する。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type Props = {
  calendarItemId: string;
  disabled?: boolean;
};


type Booking = {
  id: string;
  calendar_item_id: string;
  title: string;
  status:
    | "draft"
    | "open"
    | "closed";
  acceptance_mode:
    | "instant"
    | "approval";
};


export default function CalendarBookingControl({
  calendarItemId,
  disabled = false,
}: Props) {
  const [
    booking,
    setBooking,
  ] =
    React.useState<
      Booking | null
    >(null);


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
    message,
    setMessage,
  ] =
    React.useState("");


  async function getAccessToken() {
    const {
      data: {
        session,
      },
    } =
      await supabase.auth
        .getSession();

    return (
      session?.access_token ??
      null
    );
  }


  React.useEffect(() => {
    let cancelled =
      false;


    async function load() {
      if (disabled) {
        setLoading(false);
        return;
      }


      setLoading(true);


      try {
        const accessToken =
          await getAccessToken();


        if (
          !accessToken
        ) {
          return;
        }


        const response =
          await fetch(
            `/api/calendar/bookings?calendarItemId=${encodeURIComponent(
              calendarItemId,
            )}`,
            {
              method:
                "GET",

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
          cancelled
        ) {
          return;
        }


        if (
          !response.ok ||
          !result?.ok
        ) {
          setMessage(
            result?.message ??
              "予約受付情報を取得できませんでした。",
          );

          return;
        }


        const firstBooking =
          Array.isArray(
            result.bookings,
          )
            ? result.bookings[0] ??
              null
            : null;


        setBooking(
          firstBooking,
        );
      } catch (error) {
        console.error(
          "[CalendarBookingControl] load failed:",
          error,
        );


        if (
          !cancelled
        ) {
          setMessage(
            "予約受付情報を取得できませんでした。",
          );
        }
      } finally {
        if (
          !cancelled
        ) {
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
  }, [
    calendarItemId,
    disabled,
  ]);


  const isOpen =
    booking?.status ===
    "open";


  async function toggleBooking() {
    if (
      saving ||
      disabled
    ) {
      return;
    }


    setSaving(true);
    setMessage("");


    try {
      const accessToken =
        await getAccessToken();


      if (
        !accessToken
      ) {
        setMessage(
          "ログイン情報を確認できませんでした。",
        );

        return;
      }


      const nextEnabled =
        !isOpen;


      const response =
        await fetch(
          "/api/calendar/bookings",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                calendarItemId,
                enabled:
                  nextEnabled,
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
            "予約受付を変更できませんでした。",
        );

        return;
      }


      setBooking(
        result.booking ??
          null,
      );
    } catch (error) {
      console.error(
        "[CalendarBookingControl] toggle failed:",
        error,
      );

      setMessage(
        "予約受付を変更できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }


  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="先に日時を設定してください"
        className="shrink-0 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-300"
      >
        予約受付 OFF
      </button>
    );
  }


  return (
    <div>
      <button
        type="button"
        disabled={
          loading ||
          saving
        }
        onClick={() => {
          void toggleBooking();
        }}
        className={
          isOpen
            ? "shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
            : "shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-neutral-500 disabled:opacity-50"
        }
      >
        {loading
          ? "予約受付..."
          : saving
            ? "変更中..."
            : isOpen
              ? "予約受付 ON"
              : "予約受付 OFF"}
      </button>

      {message ? (
        <div className="mt-1 max-w-48 text-[10px] leading-4 text-red-500">
          {message}
        </div>
      ) : null}
    </div>
  );
}
