// src/components/parari/billing/CurrentPlanPanel.tsx
// 2026-07-11 JST

"use client";

import { useEffect, useState } from "react";
import {
  getEffectivePlan,
  getPlanLabel,
  getPlanLimits,
  type EffectivePlan,
} from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";

type BillingRow = {
  plan: "free" | "plus" | "pro" | string | null;
  billing_status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

function getPlanMessage(
  effectivePlan: EffectivePlan,
  status: BillingRow["billing_status"],
): string {
  if (effectivePlan === "plus") {
    return "PARARI Plusをご利用中です。Plusの利用上限が適用されています。";
  }

  if (effectivePlan === "pro") {
    return "PARARI Proをご利用中です。";
  }

  if (status === "past_due" || status === "unpaid") {
    return "お支払いの確認が必要なため、現在はFreeプランとして扱われています。請求管理からお支払い状況をご確認ください。";
  }

  if (status === "canceled") {
    return "Plusプランは終了しています。現在はFreeプランとしてご利用いただけます。";
  }

  if (status === "incomplete" || status === "incomplete_expired") {
    return "Plus申込が完了していません。必要な場合は、もう一度Plus申込を行ってください。";
  }

  return "現在はFreeプランです。無料の利用上限内で作品を作成・公開できます。";
}

function getStatusLabel(
  status: BillingRow["billing_status"],
): string {
  switch (status) {
    case "active":
      return "有効";
    case "trialing":
      return "試用中";
    case "past_due":
      return "支払い確認が必要";
    case "canceled":
      return "解約済み";
    case "incomplete":
      return "手続き未完了";
    case "incomplete_expired":
      return "手続き期限切れ";
    case "unpaid":
      return "未払い";
    case "none":
    case null:
    case undefined:
      return "未契約";
    default:
      return status;
  }
}

function getStatusTone(
  status: BillingRow["billing_status"],
): string {
  switch (status) {
    case "active":
    case "trialing":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";

    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "border-amber-100 bg-amber-50 text-amber-700";

    case "canceled":
    case "none":
    case null:
    case undefined:
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatLimit(value: number | null): string {
  return value === null ? "無制限" : `${value}`;
}

export default function CurrentPlanPanel() {
  const [billing, setBilling] = useState<BillingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      setLoading(true);
      setMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError) {
        setMessage("ログイン情報を確認できませんでした。");
        setLoading(false);
        return;
      }

      if (!user) {
        setMessage("ログインすると現在のプランを確認できます。");
        setBilling(null);
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!sessionError && session?.access_token) {
        try {
          const syncResponse = await fetch(
            "/api/billing/sync",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            },
          );

          if (syncResponse.ok) {
            const syncResult =
              (await syncResponse.json()) as {
                billing?: BillingRow | null;
              };

            if (cancelled) return;

            setBilling(
              syncResult.billing ?? null,
            );
            setLoading(false);
            return;
          }

          console.warn(
            "[CurrentPlanPanel] Stripe sync failed:",
            syncResponse.status,
          );
        } catch (syncError) {
          console.warn(
            "[CurrentPlanPanel] Stripe sync request failed:",
            syncError,
          );
        }
      }

      const { data, error } = await supabase
        .from("user_billing")
        .select(
          "plan, billing_status, cancel_at_period_end, current_period_end",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(
          "[CurrentPlanPanel] failed to load billing:",
          error,
        );
        setMessage("現在のプラン情報を読み込めませんでした。");
        setBilling(null);
        setLoading(false);
        return;
      }

      setBilling(data ?? null);
      setLoading(false);
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, []);

  const rawStatus = billing?.billing_status ?? "none";
  const effectivePlan = getEffectivePlan(billing);
  const planLabel = getPlanLabel(effectivePlan);
  const limits = getPlanLimits(effectivePlan);
  const planMessage = getPlanMessage(effectivePlan, rawStatus);
  const statusLabel = getStatusLabel(rawStatus);
  const statusTone = getStatusTone(rawStatus);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
          CURRENT PLAN
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-950">
          現在のプラン
        </h2>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">
          プラン情報を確認しています…
        </p>
      ) : message ? (
        <p className="text-sm text-slate-600">
          {message}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  現在適用されているプラン
                </p>

                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                  {planLabel}
                </p>
              </div>

              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}
              >
                {statusLabel}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              {planMessage}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold text-slate-400">
                作品作成
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatLimit(limits.workLimit)}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  作品
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold text-slate-400">
                公開作品
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatLimit(limits.publishedWorkLimit)}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  作品
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold text-slate-400">
                1作品のページ数
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatLimit(limits.pageLimitPerWork)}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  ページ
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-400">
                請求ステータス
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {statusLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-400">
                次回更新日
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(billing?.current_period_end ?? null)}
              </p>
            </div>
          </div>

          {billing?.cancel_at_period_end ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Plusは現在の請求期間の終了時に解約されます。それまではPlusを利用できます。
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
