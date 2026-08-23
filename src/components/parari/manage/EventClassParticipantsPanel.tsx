// src/components/parari/manage/EventClassParticipantsPanel.tsx
// 2026-08-23 JST

"use client";

import * as React from "react";

import ParticipantsPanel from "@/components/parari/manage/ParticipantsPanel";

import {
  supabase,
} from "@/lib/supabaseClient";


type Props = {
  calendarItemId: string;
  title: string;
};


export default function EventClassParticipantsPanel({
  calendarItemId,
  title,
}: Props) {
  const [
    applicationId,
    setApplicationId,
  ] =
    React.useState<
      string | null
    >(null);

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
                "参加者を見るにはログインが必要です。",
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


          if (
            !response.ok ||
            !result?.ok
          ) {
            if (!cancelled) {
              setMessage(
                result?.message ??
                  "参加者情報を取得できませんでした。",
              );
            }

            return;
          }


          const booking =
            Array.isArray(
              result.bookings,
            )
              ? result.bookings[0] ??
                null
              : null;


          if (!cancelled) {
            setApplicationId(
              booking?.id
                ? String(
                    booking.id,
                  )
                : null,
            );

            if (!booking?.id) {
              setMessage(
                "予約受付はまだ設定されていません。",
              );
            }
          }
        } catch (error) {
          console.error(
            "[EventClassParticipantsPanel] load failed:",
            error,
          );

          if (!cancelled) {
            setMessage(
              "参加者情報を取得できませんでした。",
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
      calendarItemId,
    ],
  );


  if (loading) {
    return (
      <p className="text-sm text-neutral-500">
        参加者を読み込んでいます...
      </p>
    );
  }


  if (
    message &&
    !applicationId
  ) {
    return (
      <p className="text-sm text-neutral-600">
        {
          message
        }
      </p>
    );
  }


  if (!applicationId) {
    return null;
  }


  return (
    <ParticipantsPanel
      applicationId={
        applicationId
      }
      title={
        title
      }
    />
  );
}
