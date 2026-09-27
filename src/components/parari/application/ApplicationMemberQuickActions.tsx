"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";
import ApplicationPassCard from "@/components/parari/panels/application/ApplicationPassCard";

type EntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled"
  | "expired";

type QuickEntry = {
  id: string;
  status: EntryStatus;
  application: {
    id: string;
    title: string;
    pass_enabled: boolean;
  };
};

type ActiveQuickEntry =
  Omit<QuickEntry, "status"> & {
    status: "submitted" | "confirmed";
  };

export default function ApplicationMemberQuickActions() {
  const [entries, setEntries] = React.useState<ActiveQuickEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        if (!supabase) {
          if (!cancelled) {
            setMessage("ログイン情報を確認できませんでした。");
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setMessage("参加状況を見るにはログインしてください。");
          }
          return;
        }

        const response = await fetch(
          "/api/application/my-entries",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result =
          (await response.json().catch(() => null)) as
            | {
                ok?: boolean;
                entries?: QuickEntry[];
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !result?.ok) {
          setMessage(
            result?.message ??
              "参加状況を取得できませんでした。",
          );
          return;
        }

        setEntries(
          (result.entries ?? []).filter(
            (entry): entry is ActiveQuickEntry =>
              entry.status === "submitted" ||
              entry.status === "confirmed",
          ),
        );
      } catch (error) {
        console.error(
          "[APPLICATION MEMBER QUICK ACTIONS] load failed:",
          error,
        );

        if (!cancelled) {
          setMessage("参加状況を取得できませんでした。");
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

  if (loading) {
    return null;
  }

  if (message || entries.length === 0) {
    return null;
  }

  const hasPasses =
    entries.some(
      (entry) =>
        entry.status === "confirmed" &&
        entry.application.pass_enabled,
    );

  return (
    <section className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="text-sm font-bold text-neutral-950">
        {hasPasses
          ? "参加証・申込の操作"
          : "申込の操作"}
      </div>
      <p className="mt-1 text-xs leading-6 text-neutral-500">
        {hasPasses
          ? "確定した参加証の表示と、申込時の内容・条件を確認できます。"
          : "申込時の内容・条件を確認できます。"}
      </p>

      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-950">
                  {entry.application.title}
                </div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  {entry.status === "confirmed"
                    ? "参加確定"
                    : "承認待ち"}
                </div>
              </div>

              <a
                href={`/my/applications?entry=${encodeURIComponent(entry.id)}`}
                className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
              >
                申込内容を確認
              </a>
            </div>

            {entry.status === "confirmed" &&
            entry.application.pass_enabled ? (
              <details className="mt-4 border-t border-neutral-100 pt-4">
                <summary className="cursor-pointer text-sm font-bold text-neutral-700">
                  参加証（QRコード）を見る
                </summary>
                <ApplicationPassCard
                  entryId={entry.id}
                  title={entry.application.title}
                  storageHint="library"
                />
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
