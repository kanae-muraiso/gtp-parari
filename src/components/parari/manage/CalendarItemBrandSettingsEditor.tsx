// src/components/parari/manage/CalendarItemBrandSettingsEditor.tsx
// 2026-08-23 JST
//
// calendar_item の基本設定Editor。
//
// ブランドネーム、時間、会場、定員、最低開催人数、料金、
// 紹介文、公開プロフィール表示をまとめて編集する。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

export type CalendarItemBrandSettings = {
  id: string;
  title: string;
  duration_minutes: number;
  location: string | null;
  capacity: number | null;
  minimum_capacity: number | null;
  fee_amount: number | null;
  fee_currency: string;
  summary: string | null;
  show_in_profile: boolean;
};

type Props = {
  item: CalendarItemBrandSettings;
  onSaved?: (
    item: CalendarItemBrandSettings,
  ) => void;
};

export default function CalendarItemBrandSettingsEditor({
  item,
  onSaved,
}: Props) {
  const [
    title,
    setTitle,
  ] = React.useState(
    item.title ?? "",
  );

  const [
    durationMinutes,
    setDurationMinutes,
  ] = React.useState(
    String(
      item.duration_minutes ??
        "",
    ),
  );

  const [
    location,
    setLocation,
  ] = React.useState(
    item.location ?? "",
  );

  const [
    capacity,
    setCapacity,
  ] = React.useState(
    item.capacity === null
      ? ""
      : String(
          item.capacity,
        ),
  );

  const [
    minimumCapacity,
    setMinimumCapacity,
  ] = React.useState(
    item.minimum_capacity ===
      null
      ? ""
      : String(
          item.minimum_capacity,
        ),
  );

  const [
    feeAmount,
    setFeeAmount,
  ] = React.useState(
    item.fee_amount === null
      ? ""
      : String(
          item.fee_amount,
        ),
  );

  const [
    summary,
    setSummary,
  ] = React.useState(
    item.summary ?? "",
  );

  const [
    showInProfile,
    setShowInProfile,
  ] = React.useState(
    item.show_in_profile === true,
  );

  const [
    saving,
    setSaving,
  ] = React.useState(false);

  const [
    message,
    setMessage,
  ] = React.useState("");

  React.useEffect(() => {
    setTitle(
      item.title ?? "",
    );

    setDurationMinutes(
      String(
        item.duration_minutes ??
          "",
      ),
    );

    setLocation(
      item.location ?? "",
    );

    setCapacity(
      item.capacity === null
        ? ""
        : String(
            item.capacity,
          ),
    );

    setMinimumCapacity(
      item.minimum_capacity ===
        null
        ? ""
        : String(
            item.minimum_capacity,
          ),
    );

    setFeeAmount(
      item.fee_amount === null
        ? ""
        : String(
            item.fee_amount,
          ),
    );

    setSummary(
      item.summary ?? "",
    );

    setShowInProfile(
      item.show_in_profile === true,
    );

    setMessage("");
  }, [
    item.id,
    item.title,
    item.duration_minutes,
    item.location,
    item.capacity,
    item.minimum_capacity,
    item.fee_amount,
    item.summary,
    item.show_in_profile,
  ]);

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
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      const response =
        await fetch(
          "/api/calendar/items",
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
                calendarItemId:
                  item.id,
                title,
                durationMinutes,
                location,
                capacity,
                minimumCapacity,
                feeAmount,
                feeCurrency:
                  item.fee_currency ||
                  "JPY",
                summary,
                showInProfile,
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
        !result.item
      ) {
        setMessage(
          result?.message ??
            "基本設定を保存できませんでした。",
        );
        return;
      }

      setTitle(
        result.item.title ?? "",
      );

      setDurationMinutes(
        String(
          result.item
            .duration_minutes ??
            "",
        ),
      );

      setLocation(
        result.item.location ??
          "",
      );

      setCapacity(
        result.item.capacity ===
          null
          ? ""
          : String(
              result.item
                .capacity,
            ),
      );

      setMinimumCapacity(
        result.item
          .minimum_capacity ===
          null
          ? ""
          : String(
              result.item
                .minimum_capacity,
            ),
      );

      setFeeAmount(
        result.item.fee_amount ===
          null
          ? ""
          : String(
              result.item
                .fee_amount,
            ),
      );

      setSummary(
        result.item.summary ?? "",
      );

      setShowInProfile(
        result.item.show_in_profile === true,
      );

      onSaved?.(
        result.item,
      );

      setMessage(
        "保存しました。",
      );
    } catch (error) {
      console.error(
        "[CalendarItemBrandSettingsEditor] save failed:",
        error,
      );

      setMessage(
        "基本設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="text-sm font-bold text-neutral-950">
        基本設定
      </div>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        ブランドの基本情報はいつでも変更できます。
      </p>

      <label className="mt-5 block">
        <span className="text-sm font-bold text-neutral-700">
          クラス・イベント名
        </span>

        <input
          value={title}
          onChange={(event) =>
            setTitle(
              event.target.value,
            )
          }
          className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
        />
      </label>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label>
          <span className="text-sm font-bold text-neutral-700">
            時間
          </span>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(event) =>
                setDurationMinutes(
                  event.target.value,
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
            <span className="text-sm text-neutral-500">
              分
            </span>
          </div>
        </label>

        <label>
          <span className="text-sm font-bold text-neutral-700">
            会場
          </span>

          <input
            value={location}
            onChange={(event) =>
              setLocation(
                event.target.value,
              )
            }
            placeholder="例：○○スタジオ"
            className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        <label>
          <span className="text-sm font-bold text-neutral-700">
            定員
          </span>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(event) =>
                setCapacity(
                  event.target.value,
                )
              }
              placeholder="任意"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
            <span className="text-sm text-neutral-500">
              人
            </span>
          </div>
        </label>

        <label>
          <span className="text-sm font-bold text-neutral-700">
            最低開催人数
          </span>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={minimumCapacity}
              onChange={(event) =>
                setMinimumCapacity(
                  event.target.value,
                )
              }
              placeholder="任意"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
            <span className="text-sm text-neutral-500">
              人
            </span>
          </div>
        </label>

        <label>
          <span className="text-sm font-bold text-neutral-700">
            料金
          </span>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={feeAmount}
              onChange={(event) =>
                setFeeAmount(
                  event.target.value,
                )
              }
              placeholder="任意"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
            <span className="text-sm text-neutral-500">
              {item.fee_currency ===
              "JPY"
                ? "円"
                : item.fee_currency}
            </span>
          </div>
        </label>
      </div>

      <div className="mt-7 border-t border-neutral-100 pt-5">
        <div className="text-sm font-bold text-neutral-950">
          紹介文
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          公開ページやプロフィールに表示する短い紹介文です。
        </p>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-bold text-neutral-700">
          短い紹介文
        </span>

        <textarea
          value={summary}
          onChange={(
            event,
          ) =>
            setSummary(
              event.target.value,
            )
          }
          rows={3}
          placeholder="例：毎週金曜の夜、京都寺町で開催しています。初心者の方も歓迎です。"
          className="mt-2 w-full resize-y rounded-2xl border border-neutral-200 px-4 py-3 text-sm leading-6 outline-none focus:border-neutral-400"
        />
      </label>



      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={
            () => void save()
          }
          disabled={saving}
          className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving
            ? "保存中..."
            : "保存"}
        </button>

        {message ? (
          <span className="text-xs text-neutral-500">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
