"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import ApplicationPassCard from "@/components/parari/panels/application/ApplicationPassCard";
import ApplicationDeliveryDownloadButton from "@/components/parari/panels/application/ApplicationDeliveryDownloadButton";

type CancellationInfo = {
  application_title: string;
  entry_status: string;
  pass_code: string | null;
  can_cancel: boolean;
  action: "withdraw" | "cancel";
  message: string;
  deadline_at: string | null;
  refund_notice: string | null;
  delivery:
    | {
        file_name: string;
        size: number;
      }
    | null;
  delivery_ready: boolean;
  delivery_message: string;
};

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "受付済み";
    case "confirmed":
      return "参加確定";
    case "rejected":
      return "不承認";
    case "withdrawn":
      return "取り下げ済み";
    case "cancelled":
      return "キャンセル済み";
    case "expired":
      return "失効";
    default:
      return "確認中";
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case "submitted":
      return "お申し込みを受け付けました。現在、主催者の確認待ちです。";
    case "confirmed":
      return "お申し込みは確定しています。";
    case "rejected":
      return "このお申し込みは承認されませんでした。";
    case "withdrawn":
      return "このお申し込みは取り下げ済みです。";
    case "cancelled":
      return "この参加はキャンセル済みです。";
    case "expired":
      return "支払期限が終了したため、このお申し込みは失効しています。";
    default:
      return "現在の申込状況を確認できません。";
  }
}

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
          | ({
              ok?: boolean;
              message?: string;
              delivery?: {
                file_name?: unknown;
                size?: unknown;
              } | null;
              delivery_ready?: boolean;
              delivery_message?: string;
            } & Partial<CancellationInfo>)
          | null;

        if (cancelled) return;

        if (!response.ok || !result?.ok || !result.application_title) {
          setMessage(result?.message ?? "申込状況を確認できませんでした。");
          return;
        }

        setInfo({
          application_title: result.application_title,
          entry_status: result.entry_status ?? "",
          pass_code:
            typeof result.pass_code === "string"
              ? result.pass_code
              : null,
          can_cancel: result.can_cancel === true,
          action: result.action === "withdraw" ? "withdraw" : "cancel",
          message: result.message ?? "",
          deadline_at: result.deadline_at ?? null,
          refund_notice: result.refund_notice ?? null,
          delivery:
            result.delivery &&
            typeof result.delivery === "object" &&
            typeof result.delivery.file_name === "string"
              ? {
                  file_name:
                    result.delivery.file_name,
                  size:
                    typeof result.delivery.size === "number"
                      ? result.delivery.size
                      : 0,
                }
              : null,
          delivery_ready:
            result.delivery_ready === true,
          delivery_message:
            typeof result.delivery_message === "string"
              ? result.delivery_message
              : "",
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
      setInfo((current) =>
        current
          ? {
              ...current,
              can_cancel: false,
              entry_status:
                result.action === "withdrawn"
                  ? "withdrawn"
                  : "cancelled",
              pass_code: null,
              message: "",
            }
          : current,
      );
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
          申込内容・参加証
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-neutral-500">申込状況を確認しています...</p>
        ) : info ? (
          <>
            <div className="mt-6 rounded-2xl bg-neutral-50 p-5">
              <div className="text-sm font-bold text-neutral-950">
                {info.application_title}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-4">
                <span className="text-xs font-semibold text-neutral-500">
                  現在の申込状況
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 shadow-sm">
                  {statusLabel(info.entry_status)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                {statusDescription(info.entry_status)}
              </p>
              {!completed && info.message ? (
                <p className="mt-3 border-t border-neutral-200 pt-3 text-xs leading-6 text-neutral-500">
                  {info.message}
                </p>
              ) : null}
            </div>

            {info.entry_status === "confirmed" && info.pass_code ? (
              <section className="mt-6">
                <h2 className="text-base font-bold text-neutral-950">
                  当日の参加証
                </h2>
                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  この認証リンクから、必要なときに何度でも表示できます。
                </p>
                <ApplicationPassCard
                  passCode={info.pass_code}
                  title={info.application_title}
                  storageHint="authenticated-link"
                />
              </section>
            ) : null}

            {info.delivery ? (
              <ApplicationDeliveryDownloadButton
                guestToken={token}
                fileName={
                  info.delivery.file_name
                }
                size={
                  info.delivery.size
                }
                ready={
                  info.delivery_ready
                }
                pendingMessage={
                  info.delivery_message
                }
              />
            ) : null}

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
