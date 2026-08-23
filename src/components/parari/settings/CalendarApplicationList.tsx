// src/components/parari/settings/CalendarApplicationList.tsx
// 2026-08-23 JST
//
// APPLICATION画面から見たイベント・クラス一覧。
//
// calendar_item が主催者にとっての
// 「イベント・クラス」そのもの。
//
// CALENDAR / APPLICATION の違いを画面構造には出さず、
// EventClassManagementPanel を共通利用する。

"use client";

import * as React from "react";

import EventClassManagementPanel from "@/components/parari/manage/EventClassManagementPanel";
import CalendarBookingSettingsEditor from "@/components/parari/manage/CalendarBookingSettingsEditor";

import {
  supabase,
} from "@/lib/supabaseClient";


type CalendarItem = {
  id: string;
  title: string;
  location: string | null;
  status:
    | "active"
    | "archived";
};


export default function CalendarApplicationList() {
  const [
    items,
    setItems,
  ] =
    React.useState<
      CalendarItem[]
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
                "CALENDARを確認するにはログインが必要です。",
              );
            }

            return;
          }


          const response =
            await fetch(
              "/api/calendar/items",
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
                "クラス・イベントを取得できませんでした。",
            );

            return;
          }


          const rawItems =
            Array.isArray(
              result.items,
            )
              ? result.items
              : Array.isArray(
                    result.calendarItems,
                  )
                ? result.calendarItems
                : [];


          setItems(
            rawItems.filter(
              (
                item: CalendarItem,
              ) =>
                item.status !==
                "archived",
            ),
          );
        } catch (error) {
          console.error(
            "[CalendarApplicationList] load failed:",
            error,
          );


          if (!cancelled) {
            setMessage(
              "クラス・イベントを取得できませんでした。",
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
    [],
  );


  return (
    <section className="mt-12">
      <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
        EVENT / CLASS
      </div>

      <div className="mt-1 text-base font-bold text-neutral-950">
        イベント・クラス
      </div>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        イベント・クラスの予約、開催予定、参加者、公開設定を管理します。
      </p>


      {loading ? (
        <p className="mt-5 text-sm text-neutral-500">
          イベント・クラスを読み込んでいます...
        </p>
      ) : null}


      {!loading &&
      items.length ===
        0 ? (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-sm font-bold text-neutral-900">
            イベント・クラスはありません
          </div>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            CALENDARでイベント・クラスを作成すると、ここに表示されます。
          </p>
        </div>
      ) : null}


      {!loading &&
      items.length >
        0 ? (
        <div className="mt-5 grid gap-4">
          {items.map(
            (
              item,
            ) => (
              <EventClassManagementPanel
                key={
                  item.id
                }
                calendarItemId={
                  item.id
                }
                title={
                  item.title
                }
                location={
                  item.location
                }
                basicContent={
                  <CalendarBookingSettingsEditor
                    calendarItemId={
                      item.id
                    }
                  />
                }
              />
            ),
          )}
        </div>
      ) : null}


      {message ? (
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          {
            message
          }
        </p>
      ) : null}
    </section>
  );
}
