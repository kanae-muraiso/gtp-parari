// src/app/my/purchases/page.tsx
// 2026-10-05 01:15 JST
// PART: Purchased works library
// コメント:
// - commerce_entitlementsから購入済み作品を表示する
// - 作品本文は既存parari_booksをRLS経由で読む
// - SSOTの複製はしない

"use client";

import React from "react";
import Link from "next/link";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { supabase } from "@/lib/supabaseClient";

type Entitlement = {
  work_id: string | null;
  created_at: string;
};

type Work = {
  id: string;
  title: string | null;
};

export default function PurchasesPage() {
  const [works, setWorks] =
    React.useState<Work[]>([]);
  const [loading, setLoading] =
    React.useState(true);
  const [message, setMessage] =
    React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setMessage(
            "購入済み作品を見るにはログインが必要です。",
          );
          setLoading(false);
        }
        return;
      }

      const now =
        new Date().toISOString();

      const {
        data: entitlements,
        error: entitlementError,
      } = await supabase
        .from("commerce_entitlements")
        .select(
          "work_id,created_at",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .lte("starts_at", now)
        .or(
          `expires_at.is.null,expires_at.gt.${now}`,
        )
        .order(
          "created_at",
          { ascending: false },
        );

      if (cancelled) return;

      if (entitlementError) {
        setMessage(
          "購入済み作品を確認できませんでした。",
        );
        setLoading(false);
        return;
      }

      const ids =
        Array.from(
          new Set(
            (
              (entitlements ??
                []) as Entitlement[]
            )
              .map(
                (item) =>
                  item.work_id,
              )
              .filter(
                (
                  id,
                ): id is string =>
                  Boolean(id),
              ),
          ),
        );

      if (ids.length === 0) {
        setWorks([]);
        setLoading(false);
        return;
      }

      const {
        data: workRows,
        error: workError,
      } = await supabase
        .from("parari_books")
        .select("id,title")
        .in("id", ids)
        .or(
          "is_deleted.is.null,is_deleted.eq.false",
        );

      if (cancelled) return;

      if (workError) {
        setMessage(
          "購入済み作品を読み込めませんでした。",
        );
      } else {
        const byId =
          new Map(
            ((workRows ??
              []) as Work[]).map(
              (work) => [
                work.id,
                work,
              ],
            ),
          );

        setWorks(
          ids
            .map(
              (id) =>
                byId.get(id),
            )
            .filter(
              (
                work,
              ): work is Work =>
                Boolean(work),
            ),
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="購入済み" />

        <div className="mt-6">
          <MyPrimaryTabs active="purchases" />
        </div>

        <section className="mt-8">
          <p className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            PURCHASED
          </p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-950">
            購入した作品
          </h1>
          <p className="mt-2 text-sm leading-7 text-neutral-500">
            PARARIで購入した作品は、ここからいつでも開けます。
          </p>

          {loading ? (
            <p className="mt-8 text-sm text-neutral-500">
              読み込んでいます…
            </p>
          ) : message ? (
            <p className="mt-8 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
              {message}
            </p>
          ) : works.length === 0 ? (
            <p className="mt-8 rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
              まだ購入した作品はありません。
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {works.map((work) => (
                <Link
                  key={work.id}
                  href={`/p/${work.id}`}
                  className="rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
                >
                  <div className="text-base font-bold text-neutral-950">
                    {work.title ||
                      "（無題）"}
                  </div>
                  <div className="mt-3 text-xs font-semibold text-neutral-400">
                    購入済み
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
