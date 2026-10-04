// src/app/my/operations/admin/square/page.tsx
// Internal Square diagnostics for Organizer commerce acceptance testing.

"use client";

import React from "react";
import Link from "next/link";

import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import { supabase } from "@/lib/supabaseClient";

type EventState = {
  eventType: string;
  receivedCount: number;
  processedCount: number;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
};

type Diagnostics = {
  environment: string;
  envChecks: Record<string, boolean>;
  activeConnectionCount: number | null;
  events: EventState[];
};

function formatDate(value: string | null) {
  if (!value) return "未受信";

  try {
    return new Date(value).toLocaleString(
      "ja-JP",
    );
  } catch {
    return value;
  }
}

export default function SquareDiagnosticsPage() {
  const {
    isSuperuser,
    loading: accessLoading,
  } = useParariStaff();

  const [data, setData] =
    React.useState<Diagnostics | null>(
      null,
    );
  const [loading, setLoading] =
    React.useState(false);
  const [message, setMessage] =
    React.useState("");

  const load = React.useCallback(
    async () => {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "ログイン情報を確認できませんでした。",
          );
        }

        const response = await fetch(
          "/api/internal/square-webhook-diagnostics",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              "Square診断情報を取得できませんでした。",
          );
        }

        setData(result as Diagnostics);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Square診断情報を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (isSuperuser) {
      void load();
    }
  }, [isSuperuser, load]);

  if (accessLoading) {
    return (
      <main className="min-h-screen bg-neutral-50" />
    );
  }

  if (!isSuperuser) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-lg font-bold text-neutral-950">
            アクセスできません
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            この画面はSUPERUSER専用です。
          </p>
        </div>
      </main>
    );
  }

  const allEnvReady =
    data
      ? Object.values(
          data.envChecks,
        ).every(Boolean)
      : false;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader
          title="Square診断"
          area="operations"
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
              ORGANIZER COMMERCE
            </div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              Square接続とWebhook受信状況を確認します。秘密値は表示しません。
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void load();
              }}
              className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading
                ? "確認中…"
                : "再確認"}
            </button>

            <Link
              href="/my/operations/admin"
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
            >
              戻る
            </Link>
          </div>
        </div>

        {message ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {message}
          </p>
        ) : null}

        {data ? (
          <div className="mt-8 space-y-6">
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="text-xs font-bold text-neutral-400">
                  ENVIRONMENT
                </div>
                <div className="mt-2 text-xl font-bold text-neutral-950">
                  {data.environment}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="text-xs font-bold text-neutral-400">
                  CONFIG
                </div>
                <div className={`mt-2 text-xl font-bold ${
                  allEnvReady
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}>
                  {allEnvReady
                    ? "設定済み"
                    : "不足あり"}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="text-xs font-bold text-neutral-400">
                  ACTIVE CONNECTIONS
                </div>
                <div className="mt-2 text-xl font-bold text-neutral-950">
                  {data.activeConnectionCount ??
                    "確認不可"}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-neutral-950">
                Webhookイベント
              </h2>
              <p className="mt-1 text-xs leading-6 text-neutral-500">
                Sandbox実験後、必要イベントが受信・処理済みになっているか確認します。
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-neutral-200 text-xs text-neutral-400">
                    <tr>
                      <th className="px-3 py-3">
                        Event
                      </th>
                      <th className="px-3 py-3">
                        受信
                      </th>
                      <th className="px-3 py-3">
                        処理
                      </th>
                      <th className="px-3 py-3">
                        最終受信
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map(
                      (event) => (
                        <tr
                          key={event.eventType}
                          className="border-b border-neutral-100"
                        >
                          <td className="px-3 py-4 font-mono text-xs text-neutral-800">
                            {event.eventType}
                          </td>
                          <td className="px-3 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                event.receivedCount >
                                0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-neutral-100 text-neutral-500"
                              }`}
                            >
                              {event.receivedCount}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-neutral-600">
                            {event.processedCount}
                          </td>
                          <td className="px-3 py-4 text-xs text-neutral-500">
                            {formatDate(
                              event.lastReceivedAt,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 text-xs leading-7 text-neutral-500 shadow-sm">
              Webhookの購読有無そのものはSquare Developer Dashboard側の設定です。
              この画面では、実際にPARARIへイベントが到着したかを確認できます。
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
