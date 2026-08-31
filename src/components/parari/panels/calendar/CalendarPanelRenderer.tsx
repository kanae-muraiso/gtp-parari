"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

import EventClassBrandPanel, {
  type EventClassBrandItem,
} from "../../EventClassBrandPanel";

import type {
  PanelRendererProps,
} from "../panelDefinitionTypes";

import type {
  CalendarPanelData,
} from "./calendarTypes";

export type CalendarResourceOccurrence = {
  id: string;
  calendar_item_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string | null;
  location: string | null;
  status: string;
  viewer_booking_status:
    | "submitted"
    | "confirmed"
    | "rejected"
    | null;
};

type CalendarItem =
  Omit<
    EventClassBrandItem,
    "next_occurrence"
  >;

type CalendarPanelResponse = {
  ok?: boolean;
  item?: CalendarItem;
  occurrences?: CalendarResourceOccurrence[];
  message?: string;
};

export type CalendarResourceViewProps = {
  calendarItemId: string | null;

  renderOccurrenceAction?: (
    occurrence: CalendarResourceOccurrence,
  ) => React.ReactNode;
};

function formatOccurrenceDate(
  occurrence: CalendarResourceOccurrence,
): string {
  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          occurrence.timezone,
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(
      new Date(
        occurrence.starts_at,
      ),
    );
  } catch {
    return occurrence.starts_at;
  }
}

export function CalendarResourceView({
  calendarItemId: rawCalendarItemId,
  renderOccurrenceAction,
}: CalendarResourceViewProps) {
  const calendarItemId =
    String(
      rawCalendarItemId ?? "",
    ).trim();

  const [
    item,
    setItem,
  ] =
    React.useState<
      CalendarItem | null
    >(null);

  const [
    occurrences,
    setOccurrences,
  ] =
    React.useState<
      CalendarResourceOccurrence[]
    >([]);

  const [
    state,
    setState,
  ] =
    React.useState<
      | "idle"
      | "loading"
      | "ready"
      | "error"
    >("idle");

  const [
    message,
    setMessage,
  ] =
    React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!calendarItemId) {
        setItem(null);
        setOccurrences([]);
        setState("idle");
        return;
      }

      setState("loading");
      setMessage("");

      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession();

        const response =
          await fetch(
            `/api/calendar/panel?calendarItemId=${encodeURIComponent(
              calendarItemId,
            )}`,
            {
              headers:
                session?.access_token
                  ? {
                      Authorization:
                        `Bearer ${session.access_token}`,
                    }
                  : undefined,

              cache: "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | CalendarPanelResponse
            | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.item
        ) {
          if (!cancelled) {
            setItem(null);
            setOccurrences([]);
            setMessage(
              result?.message ??
                "開催情報を表示できません。",
            );
            setState("error");
          }

          return;
        }

        if (!cancelled) {
          setItem(
            result.item,
          );

          setOccurrences(
            result.occurrences ??
              [],
          );

          setState("ready");
        }
      } catch (error) {
        console.error(
          "[CALENDAR Panel renderer] load failed:",
          error,
        );

        if (!cancelled) {
          setItem(null);
          setOccurrences([]);

          setMessage(
            "開催情報を表示できません。",
          );

          setState("error");
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

  if (!calendarItemId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        CALENDARが未設定です。
      </div>
    );
  }

  if (
    state === "idle" ||
    state === "loading"
  ) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500 shadow-sm">
        開催情報を読み込んでいます...
      </div>
    );
  }

  if (
    state === "error" ||
    !item
  ) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        {message ||
          "開催情報を表示できません。"}
      </div>
    );
  }

  const firstOccurrence =
    occurrences[0] ?? null;

  const brandItem:
    EventClassBrandItem = {
      ...item,

      next_occurrence:
        firstOccurrence
          ? {
              id:
                firstOccurrence.id,
              starts_at:
                firstOccurrence.starts_at,
              ends_at:
                firstOccurrence.ends_at,
              timezone:
                firstOccurrence.timezone,
            }
          : null,
    };

  return (
    <section className="space-y-4">
      <EventClassBrandPanel
        item={brandItem}
      />

      {occurrences.length > 0 ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            UPCOMING
          </div>

          <h3 className="mt-1 text-lg font-bold text-neutral-950">
            これからの開催
          </h3>

          <div className="mt-4 divide-y divide-neutral-100">
            {occurrences.map(
              (occurrence) => {
                const bookingStatus =
                  occurrence.viewer_booking_status;

                const bookingLabel =
                  bookingStatus === "confirmed"
                    ? "予約済み"
                    : bookingStatus === "submitted"
                    ? "承認待ち"
                    : bookingStatus === "rejected"
                    ? "不承認"
                    : null;

                return (
                <div
                  key={
                    occurrence.id
                  }
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="font-bold text-neutral-900">
                      {formatOccurrenceDate(
                        occurrence,
                      )}
                    </div>

                    {occurrence.title?.trim() &&
                    occurrence.title.trim() !==
                      item.title.trim() ? (
                      <div className="mt-1 text-sm text-neutral-600">
                        {occurrence.title}
                      </div>
                    ) : null}

                    {occurrence.location?.trim() ? (
                      <div className="mt-1 text-xs text-neutral-500">
                        {occurrence.location}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {bookingLabel ? (
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-700">
                        {bookingLabel}
                      </span>
                    ) : null}

                    {renderOccurrenceAction ? (
                      renderOccurrenceAction(
                        occurrence,
                      )
                    ) : (
                      <a
                        href={
                          `/calendar/${occurrence.id}`
                        }
                        className="inline-flex items-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
                      >
                        詳細
                      </a>
                    )}
                  </div>
                </div>
                );
              },
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}


export default function CalendarPanelRenderer({
  data,
}: PanelRendererProps<CalendarPanelData>) {
  return (
    <CalendarResourceView
      calendarItemId={
        data.calendarItemId
      }
    />
  );
}
