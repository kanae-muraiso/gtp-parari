"use client";

import * as React from "react";
import { useParams } from "next/navigation";

type CancellationInfo = {
  application_title: string;
  entry_status: string;
  can_cancel: boolean;
  action: "withdraw" | "cancel";
  message: string;
  deadline_at: string | null;
  refund_notice: string | null;
};

export default function GuestApplicationCancellationPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? "")
    .trim()
    .toLowerCase();

  const [info, setInfo] = React.useState<CancellationInfo | null>(null);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [refundNotice, setRefundNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!/^[0-9a-f]{32}$/.test(token)) {
      setMessage("キャンセルリンクを確認してください。");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/application/guest-cancel?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const result = (await response.json().catch(() => null)) as
          | ({ ok?: boolean; message?: string } & Partial<CancellationInfo>)
          | null;

        if (cancelled) return;

        if (!response.ok || !result?.ok || !result.application_title) {
          setMessage(result?.message ?? "申込状況を確認できませんでした。");
          return;
        }

        setInfo({
          application_title: result.application_title,
          entry_status: result.entry_status ?? "",
          can_cancel: result.can_cancel === true,
          action: result.action === "withdraw" ? "withdraw" : "cancel",
          message: result.message ?? "",
          deadline_at: result.deadline_at ?? null,
          refund_notice: result.refund_notice ?? null,
        });
      } catch (error) {
        console.error("[APPLICATION cancellation page] load failed:", error);
        if (!cancelled) {
          setMessage("申込状況を確認できませんでした。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submitCancellation() {
    if (!info?.can_cancel || submitting) return;

    const label =
      info.action === "withdraw"
        ? "この申込を取り下げますか？"
        : "参加をキャンセルしますか？";

    if (!window.confirm(label)) return;

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/application/guest-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            action?: "withdrawn" | "cancelled";
            refund_notice?: string | null;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "キャンセルを完了できませんでした。");
        return;
      }

      setCompleted(true);
      setRefundNotice(result.refund_notice ?? null);
      setMessage(
        result.action === "withdrawn"
          ? "申込を取り下げました。"
          : "参加をキャンセルしました。",
      );
    } catch (error) {
      console.error("[APPLICATION cancellation page] submit failed:", error);
      setMessage("キャンセルを完了できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-12 sm:py-16">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          APPLICATION
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950">
          申込の取り下げ・キャンセル
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-neutral-500">申込状況を確認しています...</p>
        ) : info ? (
          <>
            <div className="mt-6 rounded-2xl bg-neutral-50 p-5">
              <div className="text-sm font-bold text-neutral-950">
                {info.application_title}
              </div>
              {!completed && info.message ? (
                <p className="mt-2 text-sm leading-7 text-neutral-600">
                  {info.message}
                </p>
              ) : null}
            </div>

            {!completed && info.can_cancel ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitCancellation()}
                className="mt-6 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:opacity-40"
              >
                {submitting
                  ? "処理しています..."
                  : info.action === "withdraw"
                    ? "申込を取り下げる"
                    : "参加をキャンセルする"}
              </button>
            ) : null}

            {info.refund_notice && !completed ? (
              <p className="mt-4 text-xs leading-6 text-neutral-500">
                {info.refund_notice}
              </p>
            ) : null}
          </>
        ) : null}

        {message ? (
          <div className="mt-6 rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-7 text-neutral-700">
            {message}
          </div>
        ) : null}

        {refundNotice ? (
          <p className="mt-4 text-xs leading-6 text-neutral-500">
            {refundNotice}
          </p>
        ) : null}
      </div>
    </main>
  );
}
