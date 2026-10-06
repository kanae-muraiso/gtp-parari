"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type SquareConnectionState = {
  connected: boolean;
  merchantId: string | null;
  locationId: string | null;
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
    diagnostic,
    setDiagnostic,
  ] = React.useState<{
    userId: string;
    userEmail: string | null;
    environment: string;
    connectionFound: boolean;
  } | null>(null);
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
                diagnostic?: {
                  userId: string;
                  userEmail: string | null;
                  environment: string;
                  connectionFound: boolean;
                };
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
          setDiagnostic(
            result.diagnostic ?? null,
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

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
        SQUARE
      </p>

      <h2 className="mt-1 text-xl font-bold text-slate-950">
        売上を受け取るSquareアカウント
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        PARARIで作品・イベント・月謝などを販売する場合、あなた自身のSquareアカウントへ売上を受け取ります。
        PARARIがカード番号を保存することはありません。
      </p>

      {isLoading ? (
        <p className="mt-5 text-sm text-slate-500">
          接続状態を確認しています...
        </p>
      ) : !configured ? (
        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4">
          <div className="text-sm font-bold text-neutral-900">
            Square連携は準備中です
          </div>
          <p className="mt-1 text-xs leading-6 text-neutral-600">
            PARARI側のSquare設定が完了すると、ここから接続できるようになります。
          </p>
        </div>
      ) : connection?.connected ? (
        <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-4">
          <div className="text-sm font-bold text-emerald-900">
            Square接続済み
          </div>
          <p className="mt-1 text-xs leading-6 text-emerald-800">
            このアカウントでPARARI決済を受け付けられます。月謝・定期販売を初めて使う場合は、新しい権限を反映するため一度再接続してください。
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => {
                void connectSquare();
              }}
              className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-40"
            >
              {isConnecting
                ? "Squareを開いています..."
                : "Square権限を更新"}
            </button>

            <button
              type="button"
              disabled={isDisconnecting}
              onClick={() => {
                void disconnectSquare();
              }}
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-40"
            >
              {isDisconnecting
                ? "解除しています..."
                : "Square連携を解除"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isConnecting}
          onClick={() => {
            void connectSquare();
          }}
          className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
        >
          {isConnecting
            ? "Squareへ接続しています..."
            : "Squareを接続"}
        </button>
      )}

      {diagnostic ? (
        <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-6 text-slate-700">
          <div>診断: {diagnostic.userEmail ?? diagnostic.userId}</div>
          <div>Square環境: {diagnostic.environment}</div>
          <div>接続レコード: {diagnostic.connectionFound ? "あり" : "なし"}</div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-rose-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
