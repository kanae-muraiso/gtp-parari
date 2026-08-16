// src/components/parari/billing/BillingPortalButton.tsx
// 2026-07-11 JST

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function BillingPortalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleOpenPortal() {
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
        setMessage("請求管理を開くにはログインが必要です。");
        return;
      }

      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (
          result?.code === "portal_unavailable" ||
          result?.error ===
            "Stripe customer is not found for this user"
        ) {
          setMessage(
            "請求管理画面は、Plusをご契約中または過去にお申し込み済みの場合に利用できます。",
          );
          return;
        }

        console.error(
          "[BillingPortalButton] portal API error",
          result,
        );
        setMessage(
          "請求管理画面を開けませんでした。時間をおいてもう一度お試しください。",
        );
        return;
      }

      if (!result?.url) {
        setMessage(
          "請求管理画面を開けませんでした。時間をおいてもう一度お試しください。",
        );
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      console.error("[BillingPortalButton] error", error);

      setMessage(
        "請求管理画面を開けませんでした。時間をおいてもう一度お試しください。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleOpenPortal}
        disabled={isLoading}
        className="w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading
          ? "請求管理画面を準備中…"
          : "請求管理を開く"}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
