// src/components/parari/EventClassBrandPanel.tsx
// 2026-08-23 JST
//
// 公開プロフィールや将来の「探す」で共通利用する
// Event / Class BrandPanel。

"use client";

import * as React from "react";


export type EventClassBrandItem = {
  id: string;
  title: string;
  summary: string | null;
  duration_minutes: number;
  location: string | null;
  fee_amount:
    | number
    | string
    | null;
  fee_currency: string;
  next_occurrence: {
    id: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
  } | null;
};


type Props = {
  item: EventClassBrandItem;
  variant?: "card" | "plain";
};


function formatNextOccurrence(
  item: EventClassBrandItem,
) {
  const occurrence =
    item.next_occurrence;

  if (!occurrence) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          occurrence.timezone,
        month:
          "numeric",
        day:
          "numeric",
        weekday:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
      },
    ).format(
      new Date(
        occurrence.starts_at,
      ),
    );
  } catch {
    return null;
  }
}


function formatFee(
  amount:
    | number
    | string
    | null,
  currency: string,
) {
  if (amount === null) {
    return null;
  }

  const value =
    Number(amount);

  if (
    !Number.isFinite(value)
  ) {
    return null;
  }

  if (value === 0) {
    return "無料";
  }

  if (currency === "JPY") {
    return `${value.toLocaleString(
      "ja-JP",
    )}円`;
  }

  return `${value.toLocaleString()} ${currency}`;
}


export default function EventClassBrandPanel({
  item,
  variant = "card",
}: Props) {
  const nextOccurrence =
    formatNextOccurrence(
      item,
    );

  const fee =
    formatFee(
      item.fee_amount,
      item.fee_currency,
    );

  return (
    <article
      className={
        variant === "plain"
          ? "order-1 px-1 py-1 sm:px-2"
          : "rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
      }
    >
      <div className="text-lg font-bold leading-7 text-neutral-950">
        {item.title}
      </div>

      {item.summary?.trim() ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {item.summary}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-500">
        {item.location ? (
          <span>
            {item.location}
          </span>
        ) : null}

        <span>
          {item.duration_minutes}分
        </span>

        {fee ? (
          <span>
            {fee}
          </span>
        ) : null}
      </div>

      {nextOccurrence ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
          <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-bold text-white">
            次回
          </span>

          <span className="text-sm font-bold text-neutral-800">
            {nextOccurrence}
          </span>
        </div>
      ) : (
        <div className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-400">
          現在、開催予定はありません。
        </div>
      )}
    </article>
  );
}
