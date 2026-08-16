// apps/tools/parari/src/components/parari/ApplicationPanel.tsx
// apps/tools/parari/src/components/parari/ApplicationPanel.tsx
// 2026-04-04 JST

"use client";

/**
 * PART: ApplicationPanel
 * コメント:
 * - 本番用の申込パネル
 * - 表示専用
 * - 未ログイン時の冷たい印象を減らすため、
 *   申込前の補足文をやわらかく表示する
 * - 実際のログイン判定や遷移は親側の onApply に委ねる
 */

import React from "react";

type Props = {
  title: string;
  eventStartsAt?: string | null;
  deadlineText?: string | null;
  capacity?: number | null;
  isApplied: boolean;
  isApplying: boolean;
  applicationMessage?: string;
  onApply: () => void;
};

function formatEventStartsAt(value?: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function getDefaultGuideText(isApplied: boolean) {
  if (isApplied) {
    return "この募集への申込は完了しています。";
  }

  return "申込にはログインが必要です。ログイン後、そのまま申し込めます。";
}

export default function ApplicationPanel({
  title,
  eventStartsAt,
  deadlineText,
  capacity,
  isApplied,
  isApplying,
  applicationMessage,
  onApply,
}: Props) {
  const eventLabel = formatEventStartsAt(eventStartsAt);
  const guideText = applicationMessage?.trim() || getDefaultGuideText(isApplied);

  return (
    <div className="mx-4 my-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-5">
      <div className="text-center text-sm font-semibold text-gray-900">
        {title || "申込"}
      </div>

      {eventLabel ? (
        <div className="mt-2 text-center text-xs text-gray-600">
          開催日：{eventLabel}
        </div>
      ) : null}

      {deadlineText ? (
        <div className="mt-1 text-center text-xs text-gray-600">
          {deadlineText}
        </div>
      ) : null}

      {typeof capacity === "number" ? (
        <div className="mt-1 text-center text-xs text-gray-500">
          定員 {capacity} 名
        </div>
      ) : null}

      <div className="mt-4">
        {isApplied ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
          >
            申込済み
          </button>
        ) : (
          <button
            type="button"
            onClick={onApply}
            disabled={isApplying}
            className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isApplying ? "送信中..." : "申し込む"}
          </button>
        )}
      </div>

      <p className="mt-2 text-center text-xs leading-5 text-gray-500">
        {guideText}
      </p>
    </div>
  );
}
