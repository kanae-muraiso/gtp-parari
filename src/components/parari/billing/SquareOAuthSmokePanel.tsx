"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

export default function SquareOAuthSmokePanel() {
  const [running, setRunning] =
    React.useState(false);
  const [message, setMessage] =
    React.useState("");

  async function run() {
    setRunning(true);
    setMessage("");

    try {
      if (!supabase) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token =
        session?.access_token ?? null;

      if (!token) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const response = await fetch(
        "/api/internal/square-oauth-subscription-smoke",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              status?: string | null;
              message?: string;
            }
          | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ??
            "OAuth月謝診断に失敗しました。",
        );
      }

      setMessage(
        `成功: 新しいOAuth tokenだけでCatalog / Customer / Card / Subscriptionまで作成できました（status: ${result.status ?? "unknown"}）。`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "OAuth月謝診断に失敗しました。",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-amber-700">
        INTERNAL / SANDBOX
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-950">
        Square OAuth権限確認
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        再認可したSquare OAuth tokenだけを使い、Catalog / Customer / Card / Subscriptionを確認します。
      </p>
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {running
          ? "確認しています..."
          : "新しいOAuth tokenを確認"}
      </button>
      {message ? (
        <p className="mt-4 text-sm text-slate-800">
          {message}
        </p>
      ) : null}
    </section>
  );
}
