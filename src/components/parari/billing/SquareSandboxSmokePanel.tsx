"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type SmokeResult =
  | {
      ok: true;
      checkoutUrl: string;
      planId: string;
      variationId: string;
      orderId: string;
      currency: string;
    }
  | {
      ok: false;
      configured?: boolean;
      message?: string;
    };

export default function SquareSandboxSmokePanel() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [checkoutUrl, setCheckoutUrl] = React.useState<string | null>(null);

  async function token(): Promise<string | null> {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const accessToken = await token();
        if (!accessToken) return;

        const response = await fetch(
          "/api/internal/admin-status",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          },
        );

        const result = (await response
          .json()
          .catch(() => null)) as
          | { ok?: boolean; isAdmin?: boolean }
          | null;

        if (!cancelled) {
          setIsAdmin(
            response.ok &&
              result?.ok === true &&
              result?.isAdmin === true,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runSmokeTest() {
    setRunning(true);
    setMessage("");
    setCheckoutUrl(null);

    try {
      const accessToken = await token();

      if (!accessToken) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const response = await fetch(
        "/api/internal/square-sandbox-subscription-smoke",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
      );

      const result = (await response
        .json()
        .catch(() => null)) as SmokeResult | null;

      if (
        !response.ok ||
        !result ||
        result.ok !== true
      ) {
        throw new Error(
          result && "message" in result && result.message
            ? result.message
            : "Sandbox診断に失敗しました。",
        );
      }

      setCheckoutUrl(result.checkoutUrl);
      setMessage(
        `成功: Square Sandboxに月謝プランとCheckoutリンクを作成しました（${result.currency} 100）。`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sandbox診断に失敗しました。",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-amber-700">
        INTERNAL / SANDBOX
      </p>

      <h2 className="mt-1 text-xl font-bold text-slate-950">
        Square月謝API診断
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-700">
        Sandbox専用です。100円の月謝プランとCheckoutリンクを作成して、
        Catalog / Subscription Checkout APIが利用できるか確認します。
        このボタンだけでは決済は発生しません。
      </p>

      <button
        type="button"
        disabled={running}
        onClick={() => {
          void runSmokeTest();
        }}
        className="mt-5 rounded-xl bg-amber-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {running
          ? "Sandboxを確認しています..."
          : "Square Sandbox月謝APIを確認"}
      </button>

      {message ? (
        <p className="mt-4 text-sm leading-6 text-slate-800">
          {message}
        </p>
      ) : null}

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-950"
        >
          作成したSandbox Checkoutを開く
        </a>
      ) : null}
    </section>
  );
}
