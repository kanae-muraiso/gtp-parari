// src/components/parari/billing/OrganizerCheckoutButton.tsx
// 2026-10-05 01:00 JST
// PART: Organizer checkout / upgrade
// コメント:
// - FreeはOrganizerを新規契約する
// - Plusは既存Stripe SubscriptionをOrganizerへアップグレードする
// - Organizer以上では二重契約を作らない

"use client";

import { useEffect, useState } from "react";

import { getEffectivePlan } from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";

export default function OrganizerCheckoutButton() {
  const [isLoading, setIsLoading] =
    useState(false);
  const [checkingPlan, setCheckingPlan] =
    useState(true);
  const [currentPlan, setCurrentPlan] =
    useState("free");
  const [message, setMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setCheckingPlan(false);
        }
        return;
      }

      const { data, error } =
        await supabase
          .from("user_billing")
          .select("plan,billing_status")
          .eq("user_id", user.id)
          .maybeSingle();

      if (!cancelled) {
        if (!error) {
          setCurrentPlan(
            getEffectivePlan(data),
          );
        }

        setCheckingPlan(false);
      }
    }

    void loadPlan();

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
        throw new Error(
          sessionError.message,
        );
      }

      if (!session?.access_token) {
        setMessage(
          "Organizerに申し込むにはログインが必要です。",
        );
        return;
      }

      const response = await fetch(
        "/api/billing/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            plan: "organizer",
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            "Organizerの手続きに失敗しました。",
        );
      }

      if (!result?.url) {
        throw new Error(
          "遷移先URLが返ってきませんでした。",
        );
      }

      window.location.href =
        result.url;
    } catch (error) {
      console.error(
        "[OrganizerCheckoutButton] error",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Organizerの手続きに失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const disabled =
    isLoading ||
    checkingPlan ||
    currentPlan === "organizer" ||
    currentPlan === "host" ||
    currentPlan === "pro";

  let label =
    currentPlan === "plus"
      ? "Organizerへアップグレード"
      : "Organizerに申し込む";

  if (checkingPlan) {
    label = "プランを確認中…";
  } else if (
    currentPlan === "organizer"
  ) {
    label = "Organizer利用中";
  } else if (
    currentPlan === "host" ||
    currentPlan === "pro"
  ) {
    label = "上位プラン利用中";
  } else if (isLoading) {
    label =
      currentPlan === "plus"
        ? "アップグレード中…"
        : "Stripe Checkoutを準備中…";
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={disabled}
        className="w-full rounded-full border border-slate-900 bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
