// src/components/parari/billing/PlusCheckoutButton.tsx
// 2026-07-11 JST

"use client";

import { useEffect, useState } from "react";
import { getEffectivePlan } from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";

export default function PlusCheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [isCurrentPlus, setIsCurrentPlus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkCurrentPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setCheckingPlan(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_billing")
        .select("plan, billing_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(
          "[PlusCheckoutButton] failed to check plan:",
          error,
        );
        setCheckingPlan(false);
        return;
      }

      setIsCurrentPlus(getEffectivePlan(data) === "plus");
      setCheckingPlan(false);
    }

    void checkCurrentPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckout() {
    setIsLoading(true);
    setMessage(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        setMessage("Plusに申し込むにはログインが必要です。");
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: "plus",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ??
                    result?.error ?? "Checkoutの作成に失敗しました。",
        );
      }

      if (!result?.url) {
        throw new Error("Checkout URLが返ってきませんでした。");
      }

      window.location.href = result.url;
    } catch (error) {
      console.error("[PlusCheckoutButton] error", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Plus申込の開始に失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const disabled = isLoading || checkingPlan || isCurrentPlus;

  let buttonLabel = "Plusに申し込む";

  if (checkingPlan) {
    buttonLabel = "プランを確認中…";
  } else if (isCurrentPlus) {
    buttonLabel = "Plus利用中";
  } else if (isLoading) {
    buttonLabel = "Stripe Checkoutを準備中…";
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={disabled}
        className="w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
