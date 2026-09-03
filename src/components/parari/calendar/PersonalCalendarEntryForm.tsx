"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type Props = {
  timezone: string;
};


function toDateTimeLocal(
  date: Date,
): string {
  const shifted =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60 *
          1000,
    );

  return shifted
    .toISOString()
    .slice(
      0,
      16,
    );
}


function getDefaultTimes() {
  const start =
    new Date();

  start.setMinutes(
    0,
    0,
    0,
  );

  start.setHours(
    start.getHours() +
      1,
  );

  const end =
    new Date(
      start.getTime() +
        60 *
          60 *
          1000,
    );

  return {
    start:
      toDateTimeLocal(
        start,
      ),

    end:
      toDateTimeLocal(
        end,
      ),
  };
}


export default function PersonalCalendarEntryForm({
  timezone,
}: Props) {
  const [
    open,
    setOpen,
  ] =
    React.useState(false);

  const [
    title,
    setTitle,
  ] =
    React.useState("");

  const [
    startsAt,
    setStartsAt,
  ] =
    React.useState("");

  const [
    endsAt,
    setEndsAt,
  ] =
    React.useState("");

  const [
    endIsAutomatic,
    setEndIsAutomatic,
  ] =
    React.useState(true);

  const [
    location,
    setLocation,
  ] =
    React.useState("");

  const [
    memo,
    setMemo,
  ] =
    React.useState("");

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


  function openForm() {
    const defaults =
      getDefaultTimes();

    setStartsAt(
      defaults.start,
    );

    setEndsAt(
      defaults.end,
    );

    setEndIsAutomatic(
      true,
    );

    setMessage("");

    setOpen(true);
  }


  function changeStart(
    value: string,
  ) {
    setStartsAt(
      value,
    );

    if (
      !endIsAutomatic
    ) {
      return;
    }

    if (!value) {
      setEndsAt("");
      return;
    }

    const start =
      new Date(
        value,
      );

    if (
      Number.isNaN(
        start.getTime(),
      )
    ) {
      return;
    }

    setEndsAt(
      toDateTimeLocal(
        new Date(
          start.getTime() +
            60 *
              60 *
              1000,
        ),
      ),
    );
  }


  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");

    const start =
      new Date(
        startsAt,
      );

    const end =
      new Date(
        endsAt,
      );

    if (
      !title.trim() ||
      Number.isNaN(
        start.getTime(),
      ) ||
      Number.isNaN(
        end.getTime(),
      )
    ) {
      setMessage(
        "タイトル・開始日時・終了日時を入力してください。",
      );
      return;
    }

    if (
      end <= start
    ) {
      setMessage(
        "終了日時は開始日時より後にしてください。",
      );
      return;
    }

    if (!supabase) {
      setMessage(
        "ログイン情報を確認できませんでした。",
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase
          .auth
          .getSession();

      if (
        !session
          ?.access_token
      ) {
        setMessage(
          "ログインしてください。",
        );
        return;
      }

      const response =
        await fetch(
          "/api/calendar/personal",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                title:
                  title.trim(),

                startsAt:
                  start
                    .toISOString(),

                endsAt:
                  end
                    .toISOString(),

                timezone,

                location,

                memo,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | {
              ok?: boolean;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        setMessage(
          result?.message ||
            "予定を保存できませんでした。",
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "personal calendar save failed:",
        error,
      );

      setMessage(
        "予定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }


  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={
            openForm
          }
          className="inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
        >
          ＋ 予定を追加
        </button>
      </div>
    );
  }


  return (
    <form
      onSubmit={
        submit
      }
      className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6"
    >
      <div className="text-base font-bold text-neutral-950">
        自分の予定
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <div className="mb-1 text-xs font-bold text-neutral-500">
            タイトル
          </div>

          <input
            value={
              title
            }
            onChange={(
              event,
            ) =>
              setTitle(
                event.target.value,
              )
            }
            maxLength={
              120
            }
            required
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-bold text-neutral-500">
              開始日時
            </div>

            <input
              type="datetime-local"
              value={
                startsAt
              }
              onChange={(
                event,
              ) =>
                changeStart(
                  event.target.value,
                )
              }
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-bold text-neutral-500">
              終了日時
            </div>

            <input
              type="datetime-local"
              value={
                endsAt
              }
              min={
                startsAt ||
                undefined
              }
              onChange={(
                event,
              ) => {
                setEndsAt(
                  event.target.value,
                );

                setEndIsAutomatic(
                  false,
                );
              }}
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-1 text-xs font-bold text-neutral-500">
            場所
          </div>

          <input
            value={
              location
            }
            onChange={(
              event,
            ) =>
              setLocation(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-bold text-neutral-500">
            メモ
          </div>

          <textarea
            value={
              memo
            }
            onChange={(
              event,
            ) =>
              setMemo(
                event.target.value,
              )
            }
            rows={
              3
            }
            className="w-full resize-y rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>
      </div>

      {message ? (
        <div className="mt-4 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={
            saving
          }
          className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {
            saving
              ? "保存しています..."
              : "保存"
          }
        </button>

        <button
          type="button"
          disabled={
            saving
          }
          onClick={() => {
            setOpen(false);
            setMessage("");
          }}
          className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-bold text-neutral-600 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
