"use client";

import * as React from "react";

export default function GuestPassCancellationAccess({
  passCode,
}: {
  passCode: string;
}) {
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function openCancellationPage() {
    if (submitting) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage("申込時のメールアドレスを入力してください。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/application/guest-pass-access",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            passCode,
            email: normalizedEmail,
          }),
        },
      );

      const result =
        (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              cancellation_path?: string;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        typeof result.cancellation_path !== "string"
      ) {
        setMessage(
          result?.message ??
            "申込情報を確認できませんでした。",
        );
        return;
      }

      window.location.assign(
        result.cancellation_path,
      );
    } catch (error) {
      console.error(
        "[GUEST PASS CANCELLATION ACCESS] failed:",
        error,
      );
      setMessage(
        "申込情報を確認できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        参加者の方
      </div>
      <p className="mt-1 text-xs leading-6 text-neutral-500">
        PARARIへの登録は不要です。申込時のメールアドレスを確認すると、キャンセル専用ページを開けます。
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-bold text-neutral-500">
          申込時のメールアドレス
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setMessage("");
          }}
          placeholder="name@example.com"
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-600"
        />
      </label>

      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          void openCancellationPage();
        }}
        className="mt-3 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:opacity-40"
      >
        {submitting
          ? "確認しています..."
          : "申込の変更・キャンセル"}
      </button>

      {message ? (
        <p className="mt-3 text-sm leading-6 text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
