// src/components/parari/manage/EventClassManagementPanel.tsx
// 2026-08-23 JST
//
// 主催者から見た「イベント・クラス」管理パネル。
// CALENDAR / APPLICATION の双方で同じUIを使う。
//
// context:
// - calendar_item       = クラス・イベント全体
// - calendar_occurrence = 具体的な1回
//
// どちらのcontextでも
// [基本設定] [開催予定] [参加者] [公開・募集]
// の4メニューは同じ位置・同じ構造を保つ。

"use client";

import * as React from "react";

import CalendarOccurrenceEditor from "@/components/parari/manage/CalendarOccurrenceEditor";
import {
  type EventClassOccurrence,
  formatEventClassOccurrenceDateTime,
} from "@/components/parari/manage/EventClassOccurrencesPanel";

import {
  supabase,
} from "@/lib/supabaseClient";


export type EventClassSection =
  | "basic"
  | "schedule"
  | "publish";


type Props = {
  calendarItemId: string;
  title: string;
  location?: string | null;
  summary?: React.ReactNode;
  basicContent?: React.ReactNode;
  scheduleContent?: React.ReactNode;
  publishContent?: React.ReactNode;
  resourceDisplay?:
    | React.ReactNode
    | ((
        onSelectOccurrence: (
          occurrence: EventClassOccurrence,
        ) => void,
      ) => React.ReactNode);
  defaultSection?: EventClassSection | null;

  /*
   * CALENDARの日付欄など、
   * 最初から特定開催回を開く入口で使用する。
   */
  initialOccurrence?: EventClassOccurrence | null;

  /*
   * 外部入口から開いた場合の戻り先。
   * 未指定なら通常どおりイベント・クラス全体へ戻る。
   */
  onExitOccurrence?: () => void;
  exitOccurrenceLabel?: string;

  /*
   * 開催回を変更・休講・再開したとき、
   * 呼び出し元の一覧にも変更を返す。
   */
  onOccurrenceChanged?: (
    occurrence: EventClassOccurrence,
  ) => void;
};


const SECTIONS: Array<{
  id: EventClassSection;
  label: string;
}> = [
  {
    id:
      "basic",
    label:
      "基本設定",
  },
  {
    id:
      "schedule",
    label:
      "開催予定",
  },
  {
    id:
      "publish",
    label:
      "公開",
  },
];


export default function EventClassManagementPanel({
  calendarItemId,
  title,
  location,
  summary,
  basicContent,
  scheduleContent,
  publishContent,
  resourceDisplay,
  defaultSection = null,
  initialOccurrence = null,
  onExitOccurrence,
  exitOccurrenceLabel,
  onOccurrenceChanged,
}: Props) {
  const [
    openSection,
    setOpenSection,
  ] =
    React.useState<
      EventClassSection | null
    >(
      defaultSection,
    );


  const [
    selectedOccurrence,
    setSelectedOccurrence,
  ] =
    React.useState<
      EventClassOccurrence | null
    >(
      initialOccurrence,
    );


  const [
    occurrenceRefreshKey,
    setOccurrenceRefreshKey,
  ] =
    React.useState(0);


  const [
    occurrenceActionSaving,
    setOccurrenceActionSaving,
  ] =
    React.useState(false);


  const [
    occurrenceActionMessage,
    setOccurrenceActionMessage,
  ] =
    React.useState("");


  const isOccurrenceContext =
    Boolean(
      selectedOccurrence,
    );


  function selectOccurrence(
    occurrence: EventClassOccurrence,
  ) {
    setSelectedOccurrence(
      occurrence,
    );

    setOpenSection(
      null,
    );

    setOccurrenceActionMessage(
      "",
    );
  }


  function returnToEventClass() {
    if (
      onExitOccurrence
    ) {
      onExitOccurrence();

      return;
    }


    setSelectedOccurrence(
      null,
    );

    setOpenSection(
      "schedule",
    );

    setOccurrenceActionMessage(
      "",
    );
  }


  function refreshOccurrences() {
    setOccurrenceRefreshKey(
      (
        current,
      ) =>
        current +
        1,
    );
  }


  function applyOccurrenceUpdate(
    updated: Partial<EventClassOccurrence> & {
      id: string;
    },
  ) {
    setSelectedOccurrence(
      (
        current,
      ) => {
        if (!current) {
          return current;
        }


        const next = {
          ...current,
          ...updated,
        };


        onOccurrenceChanged?.(
          next,
        );


        return next;
      },
    );

    refreshOccurrences();
  }


  async function resumeOccurrence() {
    if (
      !selectedOccurrence ||
      occurrenceActionSaving
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        "この開催回を再び開催予定に戻しますか？",
      );


    if (!confirmed) {
      return;
    }


    setOccurrenceActionSaving(
      true,
    );

    setOccurrenceActionMessage(
      "",
    );


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
        setOccurrenceActionMessage(
          "ログイン情報を確認できませんでした。",
        );

        return;
      }


      const response =
        await fetch(
          "/api/calendar/occurrences/resume",
          {
            method:
              "PATCH",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                occurrenceId:
                  selectedOccurrence.id,
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
        !result.occurrence
      ) {
        setOccurrenceActionMessage(
          result?.message ??
            "開催予定に戻せませんでした。",
        );

        return;
      }


      applyOccurrenceUpdate(
        result.occurrence,
      );

      setOccurrenceActionMessage(
        "この回を開催予定に戻しました。",
      );
    } catch (error) {
      console.error(
        "[EventClassManagementPanel] resume failed:",
        error,
      );

      setOccurrenceActionMessage(
        "開催予定に戻せませんでした。",
      );
    } finally {
      setOccurrenceActionSaving(
        false,
      );
    }
  }


  const headerLocation =
    selectedOccurrence
      ?.location ??
    location ??
    null;


  const resolvedResourceDisplay =
    typeof resourceDisplay ===
    "function"
      ? resourceDisplay(
          selectOccurrence,
        )
      : resourceDisplay;

  return (
    <section className="rounded-[2rem] border-2 border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        {!selectedOccurrence &&
        resolvedResourceDisplay ? (
          resolvedResourceDisplay
        ) : null}

        <article className="order-2 px-1 py-1 sm:px-2">
      {!selectedOccurrence &&
      resolvedResourceDisplay ? null : (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
              EVENT / CLASS
            </div>

            {isOccurrenceContext ? (
              <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-white">
                この開催回
              </span>
            ) : null}
          </div>


          <h3 className="mt-1 text-lg font-bold text-neutral-950">
            {
              title
            }
          </h3>


          {selectedOccurrence ? (
            <div className="mt-2 text-sm font-bold text-neutral-800">
              {formatEventClassOccurrenceDateTime(
                selectedOccurrence,
              )}
            </div>
          ) : null}


          {headerLocation ? (
            <div className="mt-1 text-sm text-neutral-500">
              {
                headerLocation
              }
            </div>
          ) : null}


          {!selectedOccurrence &&
          summary ? (
            <div className="mt-2">
              {
                summary
              }
            </div>
          ) : null}


          {selectedOccurrence ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">


              {selectedOccurrence.status ===
              "cancelled" ? (
                <span className="font-bold text-red-600">
                  休講
                </span>
              ) : null}

              <button
                type="button"
                onClick={
                  returnToEventClass
                }
                className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-4 py-2 font-bold text-neutral-700 shadow-sm transition hover:border-neutral-500 hover:text-neutral-950"
              >
                {exitOccurrenceLabel ??
                  "← 全体の管理画面に戻る"}
              </button>
            </div>
          ) : null}
        </div>


      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map(
          (
            section,
          ) => {
            const active =
              openSection ===
              section.id;


            return (
              <button
                key={
                  section.id
                }
                type="button"
                onClick={() => {
                  setOpenSection(
                    active
                      ? null
                      : section.id,
                  );
                }}
                className={
                  active
                    ? "rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                    : "rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                }
              >
                {
                  section.label
                }
              </button>
            );
          },
        )}
      </div>


      {openSection ? (
        <div className="mt-5 border-t border-neutral-100 pt-5">
          {openSection ===
          "basic" ? (
            selectedOccurrence ? (
              <div>
                <div className="mb-4 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-600">
                  この変更は、この開催回だけに適用されます。
                  クラス・イベント全体の設定や他の開催回には影響しません。
                </div>


                {selectedOccurrence.status ===
                "cancelled" ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-bold text-neutral-900">
                      この開催回は休講です
                    </div>

                    <p className="mt-1 text-xs leading-6 text-neutral-500">
                      再び開催する場合は、開催予定に戻してください。
                    </p>

                    <button
                      type="button"
                      disabled={
                        occurrenceActionSaving
                      }
                      onClick={() => {
                        void resumeOccurrence();
                      }}
                      className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {occurrenceActionSaving
                        ? "変更しています..."
                        : "開催に戻す"}
                    </button>
                  </div>
                ) : (
                  <CalendarOccurrenceEditor
                    occurrence={
                      selectedOccurrence
                    }
                    onClose={() => {
                      setOpenSection(
                        null,
                      );
                    }}
                    onSaved={(
                      updated,
                    ) => {
                      applyOccurrenceUpdate(
                        updated,
                      );

                      setOpenSection(
                        null,
                      );
                    }}
                    onCancelled={(
                      updated,
                    ) => {
                      applyOccurrenceUpdate(
                        updated,
                      );

                      setOpenSection(
                        null,
                      );
                    }}
                  />
                )}


                {occurrenceActionMessage ? (
                  <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    {
                      occurrenceActionMessage
                    }
                  </div>
                ) : null}
              </div>
            ) : (
              basicContent ?? (
                <div className="text-sm text-neutral-500">
                  基本設定はまだありません。
                </div>
              )
            )
          ) : null}


          {openSection ===
          "schedule" ? (
            scheduleContent ?? (
              <div className="text-sm text-neutral-500">
                開催パターンはまだありません。
              </div>
            )
          ) : null}


          {openSection ===
          "publish" ? (
            selectedOccurrence ? (
              <div className="rounded-2xl bg-neutral-50 px-4 py-5">
                <div className="text-sm font-bold text-neutral-900">
                  この開催回の公開
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  この開催回の公開ページ、リンク、QRコードなどをここにまとめます。
                  個別開催ページと接続する予定です。
                </p>
              </div>
            ) : (
              publishContent ?? (
                <div className="rounded-2xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
                  公開設定はまだありません。
                </div>
              )
            )
          ) : null}
        </div>
      ) : null}
        </article>
      </div>
    </section>
  );
}
