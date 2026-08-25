"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";
import type { PanelEditorProps } from "../panelDefinitionTypes";

import type { CalendarPanelData } from "./calendarTypes";
import { serializeCalendarPanel } from "./serializeCalendarPanel";

type ManagedCalendarItem = {
  id: string;
  title: string;
  summary: string | null;
  duration_minutes: number;
  location: string | null;
  status: string;
};

export default function CalendarPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<CalendarPanelData>) {
  const [calendarItemId, setCalendarItemId] =
    React.useState(data.calendarItemId ?? "");

  const [items, setItems] =
    React.useState<ManagedCalendarItem[]>([]);

  const [loading, setLoading] =
    React.useState(true);

  const [message, setMessage] =
    React.useState("");

  React.useEffect(() => {
    setCalendarItemId(
      data.calendarItemId ?? "",
    );
  }, [data.calendarItemId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setItems([]);
            setMessage(
              "CALENDARを選択するにはログインが必要です。",
            );
          }

          return;
        }

        const response =
          await fetch(
            "/api/calendar/items",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                items?: ManagedCalendarItem[];
                message?: string;
              }
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          if (!cancelled) {
            setItems([]);
            setMessage(
              result?.message ??
                "クラス・イベント一覧を取得できませんでした。",
            );
          }

          return;
        }

        if (!cancelled) {
          setItems(
            result.items ?? [],
          );
        }
      } catch (error) {
        console.error(
          "[CALENDAR Panel editor] load failed:",
          error,
        );

        if (!cancelled) {
          setItems([]);
          setMessage(
            "クラス・イベント一覧を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  function commit(
    nextCalendarItemId: string,
  ) {
    const normalizedId =
      nextCalendarItemId.trim();

    setCalendarItemId(
      normalizedId,
    );

    onChangeRaw?.(
      serializeCalendarPanel({
        calendarItemId:
          normalizedId || null,
      }),
    );
  }

  const selectedItem =
    items.find(
      (item) =>
        item.id === calendarItemId,
    ) ?? null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
        CALENDAR
      </div>

      <div className="mt-3">
        <label className="block text-xs font-bold text-neutral-600">
          クラス・イベントを選択
        </label>

        {loading ? (
          <div className="mt-2 rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm text-neutral-500">
            CALENDARを読み込んでいます...
          </div>
        ) : items.length > 0 ? (
          <select
            value={calendarItemId}
            onChange={(event) => {
              commit(
                event.target.value,
              );
            }}
            className="mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-neutral-900"
          >
            <option value="">
              クラス・イベントを選択してください
            </option>

            {items.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-2 rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm text-neutral-600">
            作成済みのクラス・イベントがありません。
          </div>
        )}

        {message ? (
          <p className="mt-2 text-xs leading-6 text-red-600">
            {message}
          </p>
        ) : null}

        {selectedItem ? (
          <div className="mt-3 rounded-xl border border-sky-100 bg-white px-3 py-3">
            <div className="font-bold text-neutral-900">
              {selectedItem.title}
            </div>

            {selectedItem.summary?.trim() ? (
              <div className="mt-2 text-xs leading-6 text-neutral-600">
                {selectedItem.summary}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
              {selectedItem.location ? (
                <span>
                  {selectedItem.location}
                </span>
              ) : null}

              <span>
                {selectedItem.duration_minutes}分
              </span>
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          作品にはCALENDARへの参照だけを保存します。
          開催予定は公開時に最新情報を表示します。
        </p>
      </div>
    </div>
  );
}
