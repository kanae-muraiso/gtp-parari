"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type ActiveEntryStatus =
  | "submitted"
  | "confirmed";

type CancellationResult =
  | "withdrawn"
  | "cancelled";

export default function ApplicationMemberCancellationButton({
  applicationId,
  status,
  disabled = false,
  onCompleted,
}: {
  applicationId: string;
  status: ActiveEntryStatus;
  disabled?: boolean;
  onCompleted?: (
    result: CancellationResult,
  ) => void;
}) {
  const [busy, setBusy] =
    React.useState(false);
  const [message, setMessage] =
    React.useState("");

  async function cancelEntry() {
    if (
      busy ||
      disabled ||
      !applicationId
    ) {
      return;
    }

    const prompt =
      status === "submitted"
        ? "この申込を取り下げますか？"
        : "参加をキャンセルしますか？";

    if (
      typeof window !== "undefined" &&
      !window.confirm(prompt)
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (!supabase) {
        setMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage(
          "ログインが必要です。",
        );
        return;
      }

      const response = await fetch(
        "/api/application/my-entry",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            applicationId,
            action: "cancel",
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              action?:
                | "withdrawn"
                | "cancelled";
              refund_notice?: string | null;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        (
          result.action !==
            "withdrawn" &&
          result.action !==
            "cancelled"
        )
      ) {
        setMessage(
          result?.message ||
            "キャンセルを完了できませんでした。",
        );
        return;
      }

      const base =
        result.action === "withdrawn"
          ? "申込を取り下げました。"
          : "参加をキャンセルしました。";

      setMessage(
        result.refund_notice
          ? `${base} ${result.refund_notice}`
          : base,
      );

      onCompleted?.(
        result.action,
      );
    } catch (error) {
      console.error(
        "[APPLICATION MEMBER CANCELLATION] failed:",
        error,
      );
      setMessage(
        "キャンセルを完了できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={
          busy ||
          disabled
        }
        onClick={() => {
          void cancelEntry();
        }}
        className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? "処理中..."
          : status === "submitted"
            ? "申込を取り下げる"
            : "参加をキャンセルする"}
      </button>

      {message ? (
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
