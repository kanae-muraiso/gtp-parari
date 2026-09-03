"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

export type CalendarPublishSchedule = {
  id: string;
  name: string | null;
  visibility:
    | "private"
    | "public";
  show_in_profile: boolean;
  status:
    | "active"
    | "paused"
    | "ended";
};

type Props = {
  schedules:
    CalendarPublishSchedule[];
  onSaved?: (
    schedule:
      CalendarPublishSchedule,
  ) => void;
};

function PublishRow({
  schedule,
  onSaved,
}: {
  schedule:
    CalendarPublishSchedule;
  onSaved?: (
    schedule:
      CalendarPublishSchedule,
  ) => void;
}) {
  const [
    visibility,
    setVisibility,
  ] =
    React.useState<
      "private" | "public"
    >(
      schedule.visibility ===
        "public"
        ? "public"
        : "private",
    );

  const [
    showInProfile,
    setShowInProfile,
  ] =
    React.useState(
      schedule.visibility ===
        "public" &&
        schedule.show_in_profile ===
          true,
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

  React.useEffect(() => {
    const nextVisibility =
      schedule.visibility ===
      "public"
        ? "public"
        : "private";

    setVisibility(
      nextVisibility,
    );

    setShowInProfile(
      nextVisibility ===
        "public" &&
        schedule.show_in_profile ===
          true,
    );

    setMessage("");
  }, [
    schedule.id,
    schedule.visibility,
    schedule.show_in_profile,
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
          "/api/calendar/schedules/publication",
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
                scheduleId:
                  schedule.id,
                visibility,
                showInProfile:
                  visibility ===
                    "public"
                    ? showInProfile
                    : false,
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
        !result.schedule
      ) {
        setMessage(
          result?.message ??
            "公開設定を保存できませんでした。",
        );
        return;
      }

      onSaved?.(
        result.schedule,
      );

      setMessage(
        result.schedule.visibility ===
          "public"
          ? "公開設定を保存しました。"
          : "非公開にしました。",
      );
    } catch (error) {
      console.error(
        "[CalendarPublishSettingsEditor] save failed:",
        error,
      );

      setMessage(
        "公開設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="font-bold text-neutral-950">
          {schedule.name?.trim() ||
            "名称未設定"}
        </div>

        <span
          className={
            visibility === "public"
              ? "rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white"
              : "rounded-full bg-neutral-200 px-3 py-1 text-xs font-bold text-neutral-600"
          }
        >
          {visibility === "public"
            ? "公開中"
            : "非公開"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-neutral-700">
          <input
            type="radio"
            name={`calendar-publication-${schedule.id}`}
            checked={
              visibility ===
                "private"
            }
            onChange={() => {
              setVisibility(
                "private",
              );
              setShowInProfile(
                false,
              );
            }}
          />
          非公開
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-neutral-700">
          <input
            type="radio"
            name={`calendar-publication-${schedule.id}`}
            checked={
              visibility ===
                "public"
            }
            onChange={() => {
              setVisibility(
                "public",
              );
            }}
          />
          公開
        </label>
      </div>

      <label
        className={
          visibility === "public"
            ? "mt-4 flex cursor-pointer items-start gap-3"
            : "mt-4 flex cursor-not-allowed items-start gap-3 opacity-40"
        }
      >
        <input
          type="checkbox"
          checked={
            showInProfile
          }
          disabled={
            visibility !==
              "public"
          }
          onChange={(event) => {
            setShowInProfile(
              event.target.checked,
            );
          }}
          className="mt-1 h-4 w-4"
        />

        <span>
          <span className="block text-sm font-bold text-neutral-800">
            公開プロフィールに表示する
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            オフでも公開中なら、直接の公開ページには表示されます。
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={saving}
          className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
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

export default function CalendarPublishSettingsEditor({
  schedules,
  onSaved,
}: Props) {
  if (
    schedules.length === 0
  ) {
    return (
      <div className="rounded-2xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
        先にクラス・イベントを作成してください。
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-5">
      <div className="text-sm font-bold text-neutral-950">
        公開設定
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        クラス・イベントごとに公開状態を設定します。
      </p>

      <div className="mt-5 grid gap-4">
        {schedules.map(
          (schedule) => (
            <PublishRow
              key={
                schedule.id
              }
              schedule={
                schedule
              }
              onSaved={
                onSaved
              }
            />
          ),
        )}
      </div>
    </div>
  );
}
