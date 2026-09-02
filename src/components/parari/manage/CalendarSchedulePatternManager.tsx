"use client";

import * as React from "react";

type RecurrenceRule = {
  freq?: string;
  interval?: number;
  byWeekday?: number[];
  byMonthDay?: number[];
  anchorDate?: string;
};

type RecurrenceType =
  | "once"
  | "weekly"
  | "biweekly"
  | "monthly";

export type CalendarSchedulePattern = {
  id: string;
  calendar_item_id: string;
  timezone: string;
  start_date: string;
  start_time: string;
  end_date: string | null;
  name: string | null;
  location: string | null;
  duration_minutes: number | null;
  occurrence_horizon_days: number;
  application_open_days_before: number;
  application_close_minutes_before: number;
  recurrence_rule: RecurrenceRule;
  status:
    | "active"
    | "paused"
    | "ended";
};

export type CalendarSchedulePatternDraft = {
  recurrenceType: RecurrenceType;
  startDate: string;
  startTime: string;
  endDate: string;
  timezone: string;
  name: string;
  location: string;
  durationMinutes: string;
  occurrenceHorizonDays: string;
  applicationOpenDaysBefore: string;
  applicationCloseMinutesBefore: string;
  weekday: string;
  monthDay: string;
  anchorDate: string;
};

type Props = {
  schedules: CalendarSchedulePattern[];
  itemLocation: string | null;
  itemDurationMinutes: number;
  isCreating: boolean;
  draft: CalendarSchedulePatternDraft;
  saving: boolean;
  onAddPattern: () => void;
  onCancelCreate: () => void;
  onDraftChange: (
    key: keyof CalendarSchedulePatternDraft,
    value: string,
  ) => void;
  onSavePattern: () => void;
  onRenamePattern: (
    scheduleId: string,
    name: string,
  ) => void;
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "月曜日",
  2: "火曜日",
  3: "水曜日",
  4: "木曜日",
  5: "金曜日",
  6: "土曜日",
  7: "日曜日",
};

const INPUT_CLASS =
  "mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-400";

function getPatternRuleLabel(
  schedule: CalendarSchedulePattern,
): string {
  const rule =
    schedule.recurrence_rule ??
    {};

  if (rule.freq === "once") {
    return "1回だけ";
  }

  if (
    rule.freq === "weekly" &&
    rule.interval === 2
  ) {
    const weekday =
      rule.byWeekday?.[0];

    const label =
      typeof weekday === "number"
        ? WEEKDAY_LABELS[weekday] ?? ""
        : "";

    return label
      ? `隔週 ${label}`
      : "隔週";
  }

  if (rule.freq === "weekly") {
    const weekday =
      rule.byWeekday?.[0];

    const label =
      typeof weekday === "number"
        ? WEEKDAY_LABELS[weekday] ?? ""
        : "";

    return label
      ? `毎週 ${label}`
      : "毎週";
  }

  if (rule.freq === "monthly") {
    const monthDay =
      rule.byMonthDay?.[0];

    return typeof monthDay === "number"
      ? `毎月 ${monthDay}日`
      : "毎月";
  }

  return "開催パターン";
}

function getPatternTitle(
  schedule: CalendarSchedulePattern,
): string {
  const name =
    schedule.name?.trim();

  return name ||
    getPatternRuleLabel(schedule);
}

function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

function getEndTime(
  startTime: string,
  durationMinutes: number,
): string {
  const match =
    startTime.match(
      /^(\d{1,2}):(\d{2})/,
    );

  if (!match) {
    return "";
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(durationMinutes)
  ) {
    return "";
  }

  const total =
    hour * 60 +
    minute +
    durationMinutes;

  const normalized =
    ((total % 1440) + 1440) %
    1440;

  const endHour =
    Math.floor(
      normalized / 60,
    );

  const endMinute =
    normalized % 60;

  return `${String(endHour).padStart(
    2,
    "0",
  )}:${String(endMinute).padStart(
    2,
    "0",
  )}`;
}

function formatCloseLead(
  minutes: number,
): string {
  if (
    minutes > 0 &&
    minutes % 1440 === 0
  ) {
    return `${minutes / 1440}日前`;
  }

  if (
    minutes > 0 &&
    minutes % 60 === 0
  ) {
    return `${minutes / 60}時間前`;
  }

  return `${minutes}分前`;
}

function getStatusLabel(
  status: CalendarSchedulePattern["status"],
): string | null {
  if (status === "paused") {
    return "停止中";
  }

  if (status === "ended") {
    return "終了";
  }

  return null;
}

export default function CalendarSchedulePatternManager({
  schedules,
  itemLocation,
  itemDurationMinutes,
  isCreating,
  draft,
  saving,
  onAddPattern,
  onCancelCreate,
  onDraftChange,
  onSavePattern,
  onRenamePattern,
}: Props) {
  const [
    useCustomLocation,
    setUseCustomLocation,
  ] = React.useState(false);

  const [
    useCustomDuration,
    setUseCustomDuration,
  ] = React.useState(false);

  React.useEffect(
    () => {
      if (!isCreating) {
        return;
      }

      setUseCustomLocation(
        Boolean(
          draft.location.trim(),
        ),
      );

      setUseCustomDuration(
        Boolean(
          draft.durationMinutes.trim(),
        ),
      );
    },
    [isCreating],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-neutral-950">
            開催パターン
          </h4>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            曜日・時間・会場など、開催の基本となる型です。
          </p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500">
          開催パターンはまだありません。
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {schedules.map(
            (schedule) => {
              const duration =
                schedule.duration_minutes ??
                itemDurationMinutes;

              const location =
                schedule.location?.trim() ||
                itemLocation?.trim() ||
                "";

              const endTime =
                getEndTime(
                  schedule.start_time,
                  duration,
                );

              const statusLabel =
                getStatusLabel(
                  schedule.status,
                );

              const isOnce =
                schedule.recurrence_rule
                  ?.freq === "once";

              return (
                <details
                  key={schedule.id}
                  className="rounded-2xl border border-neutral-200 bg-white"
                >
                  <summary className="cursor-pointer list-none px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold text-neutral-950">
                          {getPatternTitle(
                            schedule,
                          )}
                        </div>

                        <div className="mt-1 text-sm text-neutral-600">
                          {getPatternRuleLabel(
                            schedule,
                          )}
                          {" "}
                          {formatTime(
                            schedule.start_time,
                          )}
                          {endTime
                            ? `–${endTime}`
                            : ""}
                        </div>

                        {location ? (
                          <div className="mt-1 text-xs text-neutral-500">
                            {location}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {statusLabel ? (
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                            {statusLabel}
                          </span>
                        ) : null}

                        <span className="text-neutral-400">
                          ▼
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-neutral-100 px-4 py-4">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-3">
                      <div>
                        <div className="text-xs font-bold text-neutral-400">
                          クラス名・イベント名
                        </div>
                        <div className="mt-1 font-bold text-neutral-900">
                          {schedule.name?.trim() ||
                            "未設定"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextName =
                            window.prompt(
                              "クラス名・イベント名を変更",
                              schedule.name ??
                                "",
                            );

                          if (
                            nextName ===
                            null
                          ) {
                            return;
                          }

                          const trimmed =
                            nextName.trim();

                          if (!trimmed) {
                            window.alert(
                              "クラス名・イベント名を入力してください。",
                            );
                            return;
                          }

                          onRenamePattern(
                            schedule.id,
                            trimmed,
                          );
                        }}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-neutral-500"
                      >
                        名前を変更
                      </button>
                    </div>

                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          開催パターン
                        </dt>

                        <dd className="mt-1 font-bold text-neutral-800">
                          {getPatternRuleLabel(
                            schedule,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          時間
                        </dt>

                        <dd className="mt-1 text-neutral-700">
                          {formatTime(
                            schedule.start_time,
                          )}
                          {endTime
                            ? `–${endTime}`
                            : ""}
                          <span className="ml-2 text-xs text-neutral-400">
                            {duration}分
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          会場
                        </dt>

                        <dd className="mt-1 text-neutral-700">
                          {location ||
                            "未設定"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          開催期間
                        </dt>

                        <dd className="mt-1 text-neutral-700">
                          {schedule.start_date}
                          {isOnce
                            ? ""
                            : ` ～ ${
                                schedule.end_date ??
                                "終了日なし"
                              }`}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          予定を作る範囲
                        </dt>

                        <dd className="mt-1 text-neutral-700">
                          {schedule.occurrence_horizon_days}
                          日先まで
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-bold text-neutral-400">
                          申込受付
                        </dt>

                        <dd className="mt-1 text-neutral-700">
                          {
                            schedule.application_open_days_before
                          }
                          日前 ～{" "}
                          {formatCloseLead(
                            schedule.application_close_minutes_before,
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 text-xs text-neutral-400">
                      {schedule.location
                        ? "この開催パターン専用の会場を使用"
                        : "会場は基本設定を使用"}
                      {" ・ "}
                      {schedule.duration_minutes !==
                      null
                        ? "この開催パターン専用の時間を使用"
                        : "時間は基本設定を使用"}
                    </div>
                  </div>
                </details>
              );
            },
          )}
        </div>
      )}

      {isCreating ? (
        <div className="mt-5 rounded-2xl border border-neutral-300 bg-neutral-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-bold text-neutral-950">
                開催パターンを追加
              </div>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                ここで設定した型から、実際の開催予定を作成します。
              </p>
            </div>

            <button
              type="button"
              onClick={
                onCancelCreate
              }
              disabled={
                saving
              }
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:border-neutral-500 disabled:opacity-50"
            >
              閉じる
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-neutral-600">
                クラス名・イベント名
              </span>

              <input
                type="text"
                value={
                  draft.name
                }
                onChange={(event) => {
                  onDraftChange(
                    "name",
                    event.target.value,
                  );
                }}
                placeholder="例：金曜日クラス"
                className={INPUT_CLASS}
              />

              <span className="mt-1 block text-[11px] text-neutral-400">
                このブランドの中で表示するクラス名・イベント名です。
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-neutral-600">
                開催方法
              </span>

              <select
                value={
                  draft.recurrenceType
                }
                onChange={(event) => {
                  onDraftChange(
                    "recurrenceType",
                    event.target.value,
                  );
                }}
                className={INPUT_CLASS}
              >
                <option value="once">
                  1回だけ
                </option>
                <option value="weekly">
                  毎週
                </option>
                <option value="biweekly">
                  隔週
                </option>
                <option value="monthly">
                  毎月
                </option>
              </select>
            </label>

            {draft.recurrenceType ===
              "weekly" ||
            draft.recurrenceType ===
              "biweekly" ? (
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  曜日
                </span>

                <select
                  value={
                    draft.weekday
                  }
                  onChange={(event) => {
                    onDraftChange(
                      "weekday",
                      event.target.value,
                    );
                  }}
                  className={INPUT_CLASS}
                >
                  {Object.entries(
                    WEEKDAY_LABELS,
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}

            {draft.recurrenceType ===
            "monthly" ? (
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  毎月の日付
                </span>

                <input
                  type="number"
                  min="1"
                  max="31"
                  value={
                    draft.monthDay
                  }
                  onChange={(event) => {
                    onDraftChange(
                      "monthDay",
                      event.target.value,
                    );
                  }}
                  className={INPUT_CLASS}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-xs font-bold text-neutral-600">
                {draft.recurrenceType ===
                "once"
                  ? "開催日"
                  : "開始日"}
              </span>

              <input
                type="date"
                value={
                  draft.startDate
                }
                onChange={(event) => {
                  onDraftChange(
                    "startDate",
                    event.target.value,
                  );
                }}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-neutral-600">
                開始時刻
              </span>

              <input
                type="time"
                value={
                  draft.startTime
                }
                onChange={(event) => {
                  onDraftChange(
                    "startTime",
                    event.target.value,
                  );
                }}
                className={INPUT_CLASS}
              />
            </label>

            {draft.recurrenceType !==
            "once" ? (
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  終了日
                </span>

                <input
                  type="date"
                  min={
                    draft.startDate
                  }
                  value={
                    draft.endDate
                  }
                  onChange={(event) => {
                    onDraftChange(
                      "endDate",
                      event.target.value,
                    );
                  }}
                  className={INPUT_CLASS}
                />

                <span className="mt-1 block text-[11px] text-neutral-400">
                  空欄なら終了日なし
                </span>
              </label>
            ) : null}

            {draft.recurrenceType ===
            "biweekly" ? (
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  最初の開催日
                </span>

                <input
                  type="date"
                  value={
                    draft.anchorDate
                  }
                  onChange={(event) => {
                    onDraftChange(
                      "anchorDate",
                      event.target.value,
                    );
                  }}
                  className={INPUT_CLASS}
                />

                <span className="mt-1 block text-[11px] text-neutral-400">
                  隔週の周期を決める基準日です。
                </span>
              </label>
            ) : null}
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <div className="text-xs font-bold text-neutral-700">
              会場
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="pattern-location-mode"
                checked={
                  !useCustomLocation
                }
                onChange={() => {
                  setUseCustomLocation(
                    false,
                  );

                  onDraftChange(
                    "location",
                    "",
                  );
                }}
              />

              <span>
                基本設定を使用
                {itemLocation?.trim()
                  ? `（${itemLocation.trim()}）`
                  : "（未設定）"}
              </span>
            </label>

            <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="pattern-location-mode"
                checked={
                  useCustomLocation
                }
                onChange={() => {
                  setUseCustomLocation(
                    true,
                  );
                }}
              />

              <span>
                この開催パターンでは別の会場を使用
              </span>
            </label>

            {useCustomLocation ? (
              <input
                type="text"
                value={
                  draft.location
                }
                onChange={(event) => {
                  onDraftChange(
                    "location",
                    event.target.value,
                  );
                }}
                placeholder="会場名"
                className={INPUT_CLASS}
              />
            ) : null}
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <div className="text-xs font-bold text-neutral-700">
              開催時間
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="pattern-duration-mode"
                checked={
                  !useCustomDuration
                }
                onChange={() => {
                  setUseCustomDuration(
                    false,
                  );

                  onDraftChange(
                    "durationMinutes",
                    "",
                  );
                }}
              />

              <span>
                基本設定を使用（
                {itemDurationMinutes}
                分）
              </span>
            </label>

            <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="pattern-duration-mode"
                checked={
                  useCustomDuration
                }
                onChange={() => {
                  setUseCustomDuration(
                    true,
                  );
                }}
              />

              <span>
                この開催パターンでは別の時間を使用
              </span>
            </label>

            {useCustomDuration ? (
              <div className="mt-2 flex max-w-xs items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={
                    draft.durationMinutes
                  }
                  onChange={(event) => {
                    onDraftChange(
                      "durationMinutes",
                      event.target.value,
                    );
                  }}
                  className={INPUT_CLASS}
                />

                <span className="mt-1 text-sm text-neutral-500">
                  分
                </span>
              </div>
            ) : null}
          </div>

          <details className="mt-5 border-t border-neutral-200 pt-5">
            <summary className="cursor-pointer text-xs font-bold text-neutral-700">
              予定・申込の範囲
            </summary>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  予定を作る範囲
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="730"
                    value={
                      draft.occurrenceHorizonDays
                    }
                    onChange={(event) => {
                      onDraftChange(
                        "occurrenceHorizonDays",
                        event.target.value,
                      );
                    }}
                    className={INPUT_CLASS}
                  />

                  <span className="mt-1 text-sm text-neutral-500">
                    日先
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  申込受付開始
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="730"
                    value={
                      draft.applicationOpenDaysBefore
                    }
                    onChange={(event) => {
                      onDraftChange(
                        "applicationOpenDaysBefore",
                        event.target.value,
                      );
                    }}
                    className={INPUT_CLASS}
                  />

                  <span className="mt-1 text-sm text-neutral-500">
                    日前
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  申込受付終了
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={
                      draft.applicationCloseMinutesBefore
                    }
                    onChange={(event) => {
                      onDraftChange(
                        "applicationCloseMinutesBefore",
                        event.target.value,
                      );
                    }}
                    className={INPUT_CLASS}
                  />

                  <span className="mt-1 text-sm text-neutral-500">
                    分前
                  </span>
                </div>
              </label>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-neutral-400">
              例：30日先まで予定を作り、30日前から3時間前まで申込受付なら
              「30 / 30 / 180」です。
            </p>
          </details>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={
                onCancelCreate
              }
              disabled={
                saving
              }
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:border-neutral-500 disabled:opacity-50"
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={
                onSavePattern
              }
              disabled={
                saving
              }
              className="rounded-full bg-neutral-950 px-5 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving
                ? "保存しています..."
                : "この開催パターンを保存"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={
            onAddPattern
          }
          className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
        >
          ＋ 開催パターンを追加
        </button>
      )}
    </div>
  );
}
