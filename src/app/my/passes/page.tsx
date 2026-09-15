// src/app/my/passes/page.tsx
// 2026-09-15 JST

"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import ApplicationPassCard from "@/components/parari/panels/application/ApplicationPassCard";

type MyPass = {
  entry_id: string;
  application_id: string;
  title: string;
  participant_name: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  location: string | null;
  checked_in_at: string | null;
  created_at: string;
};

function formatDateTime(value: string | null, timezone: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: timezone || "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleString("ja-JP");
  }
}

export default function MyPassesPage() {
  const [passes, setPasses] = React.useState<MyPass[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setMessage("参加証を見るにはログインしてください。");
          }
          return;
        }

        const response = await fetch("/api/application/my-passes", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              passes?: MyPass[];
              message?: string;
            }
          | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !result?.ok) {
          setMessage(result?.message || "参加証を取得できませんでした。");
          return;
        }

        setPasses(result.passes ?? []);
      } catch (error) {
        console.error("[MY PASSES] load failed:", error);
        if (!cancelled) {
          setMessage("参加証を取得できませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="参加証" />

        <div className="mt-6">
          <MyPrimaryTabs active="applications" />
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-bold text-neutral-950">参加証</h1>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            PARARIに紐付いた参加証は、ここからいつでも表示できます。
          </p>
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            参加証を読み込んでいます...
          </div>
        ) : message ? (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 text-sm leading-7 text-neutral-600">
            {message}
          </div>
        ) : passes.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 text-center">
            <div className="font-bold text-neutral-950">参加証はまだありません</div>
            <p className="mt-2 text-sm leading-7 text-neutral-500">
              参加が確定したイベントやクラスの参加証がここに表示されます。
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {passes.map((pass) => {
              const dateLabel = formatDateTime(pass.starts_at, pass.timezone);

              return (
                <details
                  key={pass.entry_id}
                  className="group rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-neutral-950">{pass.title}</div>
                        {dateLabel ? (
                          <div className="mt-1 text-sm text-neutral-500">{dateLabel}</div>
                        ) : null}
                        {pass.location ? (
                          <div className="mt-1 text-sm text-neutral-500">{pass.location}</div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-xs font-bold text-neutral-500">
                        {pass.checked_in_at ? "受付済み" : "参加証を見る"}
                      </div>
                    </div>
                  </summary>

                  <ApplicationPassCard
                    entryId={pass.entry_id}
                    title={pass.title}
                    participantName={pass.participant_name}
                    storageHint="library"
                  />
                </details>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
