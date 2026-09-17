"use client";

import * as React from "react";

type Props = {
  accessToken: string;
  applicationId: string;
  occurrenceId?: string | null;
};

export default function CancelCheckInStartButton({
  accessToken,
  applicationId,
  occurrenceId,
}: Props) {
  const [cancelling, setCancelling] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function cancelStart() {
    if (cancelling) {
      return;
    }

    const confirmed = window.confirm(
      "入場受付の開始を取り消しますか？\n\nまだ1人も受付していない場合だけ取り消せます。",
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/application/check-in/cancel",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            applicationId,
            occurrenceId: occurrenceId || undefined,
          }),
        },
      );

      const result =
        (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              message?: string;
            }
          | null;

      if (!response.ok || !result?.ok) {
        setMessage(
          result?.message ??
            "入場受付の開始を取り消せませんでした。",
        );
        return;
      }

      window.alert(
        result.message ?? "入場受付の開始を取り消しました。",
      );
      window.location.reload();
    } catch (error) {
      console.error("[CHECK-IN CANCEL BUTTON] failed:", error);
      setMessage("入場受付の開始を取り消せませんでした。");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={cancelling}
        onClick={() => void cancelStart()}
        className="w-full rounded-full border border-emerald-700/30 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-40"
      >
        {cancelling
          ? "取り消しています..."
          : "受付開始を取り消す"}
      </button>

      <p className="mt-2 text-xs leading-6 text-emerald-800/70">
        まだ1人も受付していない場合だけ取り消せます。
      </p>

      {message ? (
        <p className="mt-2 text-xs leading-6 text-rose-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
