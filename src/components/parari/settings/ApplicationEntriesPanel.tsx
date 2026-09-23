"use client";

import ApplicationEntryMessagePanel from "@/components/parari/application/ApplicationEntryMessagePanel";

import {
  downloadApplicationEntriesCsv,
  formatApplicationAnswerValue,
  formatApplicationDateTime,
  getApplicationEntryAnswerColumns,
  getApplicationEntryAnswerValue,
  getApplicationEntryApplicantName,
  getApplicationEntryIdentityLabel,
  getApplicationEntryStatusLabel,
} from "./applicationManagerSupport";
import type {
  ApplicationEntryViewMode,
  ManagedApplication,
  ManagedApplicationEntry,
} from "./applicationManagerSupport";

type ApplicationEntryAction =
  | "qualification_approve"
  | "qualification_reject"
  | "payment_confirm";

type ApplicationEntriesPanelProps = {
  application: ManagedApplication;
  entries: ManagedApplicationEntry[];
  isLoaded: boolean;
  isLoading: boolean;
  message: string;
  viewMode: ApplicationEntryViewMode;
  onViewModeChange: (
    mode: ApplicationEntryViewMode,
  ) => void;
  openMessageEntryId: string | null;
  openMessageApplicantName: string;
  entryActionId: string | null;
  onOpenMessage: (
    entryId: string,
    applicantName: string,
  ) => void;
  onCloseMessage: () => void;
  onEntryAction: (
    entryId: string,
    action: ApplicationEntryAction,
  ) => void | Promise<void>;
};

export default function ApplicationEntriesPanel({
  application,
  entries,
  isLoaded,
  isLoading,
  message,
  viewMode,
  onViewModeChange,
  openMessageEntryId,
  openMessageApplicantName,
  entryActionId,
  onOpenMessage,
  onCloseMessage,
  onEntryAction,
}: ApplicationEntriesPanelProps) {
  const answerColumns =
    getApplicationEntryAnswerColumns(entries);

  return (
    <div className="mt-5 border-t border-neutral-100 pt-5">
      {!openMessageEntryId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-neutral-950">
              申込者
            </div>

            {isLoaded ? (
              <div className="text-xs text-neutral-400">
                {entries.length}名
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onViewModeChange("list")
              }
              className={
                viewMode === "list"
                  ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                  : "rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
              }
            >
              一覧表示
            </button>

            <button
              type="button"
              onClick={() =>
                onViewModeChange("detail")
              }
              className={
                viewMode === "detail"
                  ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                  : "rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
              }
            >
              詳細表示
            </button>

            <button
              type="button"
              disabled={entries.length === 0}
              onClick={() =>
                downloadApplicationEntriesCsv(
                  application,
                  entries,
                )
              }
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              CSV出力
            </button>
          </div>
        </div>
      ) : null}

      {!openMessageEntryId &&
      isLoading ? (
        <p className="mt-4 text-sm text-neutral-500">
          申込者を読み込んでいます...
        </p>
      ) : null}

      {!openMessageEntryId &&
      message ? (
        <p className="mt-4 text-sm text-neutral-600">
          {message}
        </p>
      ) : null}

      {!openMessageEntryId &&
      isLoaded &&
      entries.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          まだ申込者はいません。
        </p>
      ) : null}

      {!openMessageEntryId &&
      viewMode === "list" &&
      entries.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                  申込日時
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                  氏名
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                  状態
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                  本人確認
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                  連絡
                </th>

                {answerColumns.map((column) => (
                  <th
                    key={column.key}
                    className="min-w-[160px] border-b border-neutral-200 px-3 py-3 font-bold"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="align-top"
                >
                  <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-500">
                    {formatApplicationDateTime(
                      entry.created_at,
                    )}
                  </td>

                  <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 font-bold text-neutral-900">
                    {getApplicationEntryApplicantName(
                      entry,
                    )}
                  </td>

                  <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-600">
                    {getApplicationEntryStatusLabel(
                      entry.status,
                    )}
                  </td>

                  <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-600">
                    {getApplicationEntryIdentityLabel(
                      entry,
                    )}
                  </td>

                  <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenMessage(
                          entry.id,
                          getApplicationEntryApplicantName(
                            entry,
                          ),
                        )
                      }
                      className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                    >
                      メッセージ
                    </button>
                  </td>

                  {answerColumns.map((column) => (
                    <td
                      key={column.key}
                      className="min-w-[160px] border-b border-neutral-100 px-3 py-3 leading-6 text-neutral-700"
                    >
                      {getApplicationEntryAnswerValue(
                        entry,
                        column.key,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {openMessageEntryId ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onCloseMessage}
            className="mb-3 text-xs font-bold text-neutral-600 transition hover:text-neutral-950"
          >
            ← 申込者一覧へ戻る
          </button>

          <ApplicationEntryMessagePanel
            entryId={openMessageEntryId}
            counterpartLabel={
              openMessageApplicantName ||
              "申込者"
            }
          />
        </div>
      ) : null}

      {!openMessageEntryId &&
      viewMode === "detail" &&
      entries.length > 0 ? (
        <div className="mt-4 space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl bg-neutral-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-neutral-950">
                    {getApplicationEntryApplicantName(
                      entry,
                    )}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-neutral-500">
                    {getApplicationEntryIdentityLabel(
                      entry,
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600">
                    {getApplicationEntryStatusLabel(
                      entry.status,
                    )}
                  </span>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs font-bold text-neutral-500">
                      資格
                    </span>

                    {application.acceptance_mode !==
                    "approval" ? (
                      <span className="text-xs text-neutral-400">
                        確認不要
                      </span>
                    ) : entry.qualification_status ===
                      "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={
                            entryActionId ===
                            entry.id
                          }
                          onClick={() => {
                            void onEntryAction(
                              entry.id,
                              "qualification_approve",
                            );
                          }}
                          className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-700 disabled:opacity-40"
                        >
                          OK
                        </button>

                        <button
                          type="button"
                          disabled={
                            entryActionId ===
                            entry.id
                          }
                          onClick={() => {
                            void onEntryAction(
                              entry.id,
                              "qualification_reject",
                            );
                          }}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-40"
                        >
                          NG
                        </button>
                      </>
                    ) : entry.qualification_status ===
                      "approved" ? (
                      <span className="text-xs font-bold text-neutral-700">
                        ✓ OK
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-neutral-500">
                        × NG
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs font-bold text-neutral-500">
                      支払
                    </span>

                    {application.payment_method ===
                    "none" ? (
                      <span className="text-xs text-neutral-400">
                        支払不要
                      </span>
                    ) : entry.payment_status ===
                      "paid" ? (
                      <span className="text-xs font-bold text-neutral-700">
                        ✓ 支払済
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-neutral-500">
                          {entry.payment_status ===
                          "reported"
                            ? "支払連絡あり"
                            : application.payment_method ===
                                "on_site"
                              ? "当日支払予定"
                              : "未確認"}
                        </span>

                        {entry.status !==
                        "rejected" ? (
                          <button
                            type="button"
                            disabled={
                              entryActionId ===
                              entry.id
                            }
                            onClick={() => {
                              void onEntryAction(
                                entry.id,
                                "payment_confirm",
                              );
                            }}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
                          >
                            {application.payment_method ===
                            "on_site"
                              ? "支払済にする"
                              : "着金を確認"}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                申込日時：
                {formatApplicationDateTime(
                  entry.created_at,
                )}
              </div>

              {entry.agreed_at ? (
                <div className="mt-1 text-xs text-neutral-400">
                  同意日時：
                  {formatApplicationDateTime(
                    entry.agreed_at,
                  )}
                </div>
              ) : null}

              {entry.answers.length > 0 ? (
                <div className="mt-5 border-t border-neutral-200 pt-4">
                  <div className="text-xs font-bold text-neutral-500">
                    APPLICATION回答
                  </div>

                  <div className="mt-3 space-y-3">
                    {entry.answers.map((answer) => (
                      <div key={answer.field_id}>
                        <div className="text-xs font-bold text-neutral-500">
                          {answer.label}
                        </div>

                        <div className="mt-1 text-sm text-neutral-900">
                          {formatApplicationAnswerValue(
                            answer.value,
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {entry.form_submission ? (
                <div className="mt-5 border-t border-neutral-200 pt-4">
                  <div className="text-xs font-bold text-neutral-500">
                    FORM回答
                  </div>

                  <div className="mt-3 space-y-3">
                    {entry.form_submission.answers.map(
                      (answer) => (
                        <div key={answer.field_id}>
                          <div className="text-xs font-bold text-neutral-500">
                            {answer.label}
                          </div>

                          <div className="mt-1 text-sm text-neutral-900">
                            {formatApplicationAnswerValue(
                              answer.value,
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-neutral-400">
                  FORMなし
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
