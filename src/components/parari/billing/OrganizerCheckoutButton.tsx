// src/components/parari/billing/OrganizerCheckoutButton.tsx
// 2026-10-04 23:59 JST
// PART: Organizer checkout
// コメント:
// - ORGANIZER 月10ドルのStripe Checkoutを開始する
// - 既存のPlus Checkoutと同じ認証・エラーハンドリングを使う
// - SSOTや作品本文には触れない

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function OrganizerCheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        setMessage("Organizerに申し込むにはログインが必要です。");
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: "organizer",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            "Checkoutの作成に失敗しました。",
        );
      }

      if (!result?.url) {
        throw new Error("Checkout URLが返ってきませんでした。");
      }

      window.location.href = result.url;
    } catch (error) {
      console.error("[OrganizerCheckoutButton] error", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Organizer申込の開始に失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full rounded-full border border-slate-900 bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading
          ? "Stripe Checkoutを準備中…"
          : "Organizerに申し込む"}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
