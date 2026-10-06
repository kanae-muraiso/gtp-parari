"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CommerceE2ETestPanel() {
  const [running, setRunning] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function run() {
    setRunning(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログイン情報を確認できませんでした。");
      }

      const response = await fetch(
        "/api/internal/commerce-e2e/monthly-subscription",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        },
      );

      const result =
        await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ??
            "テスト④を実行できませんでした。",
        );
      }

      setMessage(
        `成功: muraiso02@muraiso.jp の月謝100円契約をSquare Sandboxで作成しました（status: ${result.status ?? "unknown"}）。`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "テスト④を実行できませんでした。",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-amber-700">
        PR #82 E2E
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-950">
        テスト④ 別ユーザーの月謝契約
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        売り手 kanae@muraiso.jp、買い手 muraiso02@muraiso.jp として、Square Sandboxで月謝100円の契約を自動作成します。カード入力もStripeもありません。
      </p>
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {running ? "実行しています..." : "テスト④を実行"}
      </button>
      {message ? (
        <p className="mt-4 text-sm font-semibold text-slate-800">
          {message}
        </p>
      ) : null}
    </section>
  );
}
