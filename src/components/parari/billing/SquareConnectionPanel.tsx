"use client";

import * as React from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";

type SquareConnectionState = {
  connected: boolean;
  merchantId: string | null;
  locationId: string | null;
  locationName: string | null;
  status: string | null;
};

export default function SquareConnectionPanel() {
  const [
    connection,
    setConnection,
  ] = React.useState<SquareConnectionState | null>(null);
  const [
    configured,
    setConfigured,
  ] = React.useState(false);
  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);
  const [
    isConnecting,
    setIsConnecting,
  ] = React.useState(false);
  const [
    message,
    setMessage,
  ] = React.useState("");
  const [
    isDisconnecting,
    setIsDisconnecting,
  ] = React.useState(false);

  async function accessToken(): Promise<string | null> {
    if (!supabase) {
      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await accessToken();

        if (!token) {
          if (!cancelled) {
            setMessage("ログイン情報を確認できませんでした。");
          }
          return;
        }

        const response = await fetch(
          "/api/square/connection",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                configured?: boolean;
                connection?: SquareConnectionState;
              }
            | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.connection
        ) {
          throw new Error(
            "Square接続状態を確認できませんでした。",
          );
        }

        if (!cancelled) {
          setConfigured(
            result.configured === true,
          );
          setConnection(
            result.connection,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Square接続状態を確認できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function connectSquare() {
    setIsConnecting(true);
    setMessage("");

    try {
      const token = await accessToken();

      if (!token) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const response = await fetch(
        "/api/square/oauth/start",
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
              url?: string;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.url
      ) {
        throw new Error(
          result?.message ??
            "Square接続を開始できませんでした。",
        );
      }

      window.location.assign(
        result.url,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Square接続を開始できませんでした。",
      );
      setIsConnecting(false);
    }
  }

  async function disconnectSquare() {
    if (
      isDisconnecting ||
      typeof window === "undefined"
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Squareとの連携を解除しますか？\n解除すると、新しいPARARI決済を受け付けるには再接続が必要です。",
    );

    if (!confirmed) {
      return;
    }

    setIsDisconnecting(true);
    setMessage("");

    try {
      const token = await accessToken();

      if (!token) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const response = await fetch(
        "/api/square/connection",
        {
          method: "DELETE",
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
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.message ??
            "Square連携を解除できませんでした。",
        );
      }

      setConnection({
        connected: false,
        merchantId: null,
        locationId: null,
        locationName: null,
        status: null,
      });
      setMessage(
        "Square連携を解除しました。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Square連携を解除できませんでした。",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  const actionClass = "rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";

  return (
    <section id="sell-work" aria-labelledby="sell-work-title" className="scroll-mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 id="sell-work-title" className="text-sm font-bold text-neutral-950">PARARIで販売する</h2>
      <p className="mt-1 text-xs leading-6 text-neutral-600">
        現在、PARARIでの作品販売はSquare決済にのみ対応しています。
      </p>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500" role="status">Squareの接続状態を確認しています…</p>
      ) : connection?.connected ? (
        <>
          <p className="mt-3 text-sm font-semibold text-emerald-800">Square接続済み</p>
          <dl className="mt-2 text-sm">
            <dt className="text-neutral-600">作品の売上を受け取るSquare店舗</dt>
            <dd className="break-words font-semibold text-neutral-950">
              {connection.locationName ?? "店舗名を確認できませんでした"}
            </dd>
            {connection.locationId ? (
              <dd className="break-all text-xs text-neutral-500">店舗ID {connection.locationId}</dd>
            ) : null}
          </dl>
          <Link className={`mt-3 inline-block ${actionClass}`} href="/my/sales">
            販売管理を開く
          </Link>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-700">Squareの再設定</summary>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              接続先を変更したいときや、月謝・定期販売に必要な権限を更新するときは、Squareに再接続します。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!configured || isConnecting || isDisconnecting} onClick={connectSquare} className={actionClass}>
                {isConnecting ? "Squareを開いています…" : "Squareに再接続"}
              </button>
              <button
                type="button"
                disabled={isConnecting || isDisconnecting}
                onClick={disconnectSquare}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-40"
              >
                {isDisconnecting ? "解除しています…" : "Square連携を解除"}
              </button>
            </div>
          </details>
        </>
      ) : connection ? (
        <>
          <p className="mt-3 text-sm text-neutral-600">
            {configured ? "Square未接続" : "Square連携は準備中です"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {configured ? (
              <button type="button" disabled={isConnecting} onClick={connectSquare} className={actionClass}>
                {isConnecting ? "Squareを開いています…" : "Squareを接続"}
              </button>
            ) : null}
            <Link className="text-sm font-semibold text-sky-800 underline underline-offset-4" href="/my/settings/square">
              Squareアカウントをお持ちでない方
            </Link>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-700">販売を始める手順</summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700">
              <li>Squareで振込先を設定し、この画面から接続します。</li>
              <li>販売管理で作品と価格を決め、「販売を開始」を押します。販売開始後の本文は購入者限定です。</li>
              <li>購入ページを確認し、そのURLを読者に知らせます。</li>
            </ol>
          </details>
          <Link className="mt-3 inline-block text-sm font-semibold text-sky-800 underline underline-offset-4" href="/my/sales">
            販売管理を開く
          </Link>
        </>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-neutral-700" role="status">{message}</p>
      ) : null}
    </section>
  );
}
