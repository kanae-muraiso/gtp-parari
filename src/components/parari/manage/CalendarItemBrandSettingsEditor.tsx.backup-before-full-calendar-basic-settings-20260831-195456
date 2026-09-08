// src/components/parari/manage/CalendarItemBrandSettingsEditor.tsx
// 2026-08-23 JST
//
// calendar_item の公開プロフィール表示設定。
// BrandPanel向けの短い紹介文と表示可否だけを担当する。

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

export type CalendarItemBrandSettings = {
  id: string;
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
    setSummary(
      item.summary ?? "",
    );

    setShowInProfile(
      item.show_in_profile === true,
    );

    setMessage("");
  }, [
    item.id,
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
            "公開プロフィール設定を保存できませんでした。",
        );
        return;
      }

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
        "公開プロフィール設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="text-sm font-bold text-neutral-950">
        公開プロフィール
      </div>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        あなたの公開プロフィールに表示するクラス・イベント情報を設定します。
      </p>

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

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={
            showInProfile
          }
          onChange={(
            event,
          ) =>
            setShowInProfile(
              event.target.checked,
            )
          }
          className="mt-1 h-4 w-4"
        />

        <span>
          <span className="block text-sm font-bold text-neutral-800">
            公開プロフィールに表示する
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            オフの場合、このクラス・イベントはあなたのプロフィールには表示されません。
          </span>
        </span>
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
