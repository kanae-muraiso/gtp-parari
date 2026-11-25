"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { classRequest } from "@/lib/classRequests";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";

type Purchase = {
  id: string;
  kind: "commerce" | "application";
  title: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  createdAt: string;
};
type Application = {
  id: string;
  title: string;
  status: string;
  paymentStatus: string | null;
  startsAt: string;
  timezone: string;
  location: string | null;
};
type Membership = {
  id: string;
  name: string;
  status: string;
  joinedAt: string;
  updatedAt: string;
};
type PurchasedWork = {
  workId: string;
  title: string;
  status: string;
  createdAt: string;
};
type Records = {
  purchases: Purchase[];
  applications: Application[];
  memberships: Membership[];
  purchasedWorks: PurchasedWork[];
};
type ClassDestination = { id: string; name: string };
type Tab = "participation" | "purchases";

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "participation", label: "参加・申込" },
  { key: "purchases", label: "購入済み" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function applicationStatus(value: string) {
  switch (value) {
    case "submitted": return "受付中";
    case "confirmed": return "参加確定";
    case "rejected": return "受付されませんでした";
    case "withdrawn": return "申込取消";
    case "cancelled": return "キャンセル";
    default: return value;
  }
}

function paymentStatus(value: string | null) {
  switch (value) {
    case "paid": return "支払済み";
    case "unpaid": return "支払待ち";
    case "reported": return "支払連絡済み";
    default: return "支払なし";
  }
}

export default function LibraryRecordsPage() {
  const [tab, setTab] = useState<Tab>("participation");
  const [records, setRecords] = useState<Records | null>(null);
  const [classes, setClasses] = useState<ClassDestination[]>([]);
  const [hasPasses, setHasPasses] = useState(false);
  const [message, setMessage] = useState("記録を読み込んでいます…");

  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("tab");
      setTab(value === "purchases" ? "purchases" : "participation");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function selectTab(value: Tab) {
    setTab(value);
    window.history.replaceState(
      null,
      "",
      "/my/bookshelf/records?tab=" + value,
    );
  }

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase) {
        setMessage("接続設定がありません。");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage("ログインが必要です。");
        return;
      }

      try {
        const [recordsResponse, classResult, passesResponse] = await Promise.all([
          fetch("/api/library-v2/records", {
            headers: { Authorization: "Bearer " + session.access_token },
            cache: "no-store",
          }),
          classRequest<{ enrolled?: ClassDestination[] }>("?home=1").catch(() => null),
          fetch("/api/application/my-passes?summary=1", {
            headers: { Authorization: "Bearer " + session.access_token },
            cache: "no-store",
          }).catch(() => null),
        ]);
        if (!active) return;

        const body = await recordsResponse.json().catch(() => null);
        if (!recordsResponse.ok || !body?.ok) {
          setMessage("記録を取得できませんでした。");
          return;
        }
        setRecords(body as Records);
        setClasses(classResult?.enrolled ?? []);

        const passesBody = await passesResponse?.json().catch(() => null);
        setHasPasses(
          Boolean(passesResponse?.ok && passesBody?.ok && passesBody?.hasPasses === true),
        );
        setMessage("");
      } catch {
        if (active) setMessage("記録を取得できませんでした。");
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const noParticipation =
    records !== null &&
    classes.length === 0 &&
    records.applications.length === 0 &&
    records.memberships.length === 0 &&
    !hasPasses;

  const noPurchases =
    records !== null &&
    records.purchases.length === 0 &&
    records.purchasedWorks.length === 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <MyAreaHeader
          title="参加・購入"
          area="library"
          navigation={<LibraryV2Menu active="records" />}
        />

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="参加・購入">
          {tabs.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => selectTab(item.key)}
              className={
                "rounded-full border px-4 py-2 text-sm " +
                (tab === item.key
                  ? WORKSPACE_PALETTE.library.tabActive
                  : "bg-white text-neutral-800 hover:bg-emerald-50")
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {message ? <p role="status" className="mt-5 text-sm text-neutral-600">{message}</p> : null}

        {!message && records ? (
          <div className="mt-5 space-y-7">
            {tab === "participation" ? (
              <>
                {classes.length > 0 ? (
                  <section aria-labelledby="classes-heading">
                    <h2 id="classes-heading" className="mb-3 text-base font-bold">参加中のクラス</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {classes.map(item => (
                        <Link
                          key={item.id}
                          href={"/my/classes/" + item.id}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 transition hover:bg-emerald-100"
                        >
                          <span className="block font-bold">{item.name}</span>
                          <span className="mt-1 block text-xs">クラスの予定を見る →</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                {records.applications.length > 0 ? (
                  <section aria-labelledby="applications-heading">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 id="applications-heading" className="text-base font-bold">申込状況</h2>
                      <Link href="/my/applications" className="text-xs font-bold text-emerald-800 underline">申込内容の確認・取消</Link>
                    </div>
                    <div className="space-y-3">
                      {records.applications.map(item => (
                        <article key={item.id} className="rounded-2xl border border-neutral-200 p-4">
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-1 text-sm text-neutral-700">
                            {formatDate(item.startsAt)} · {item.location || "場所未設定"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {applicationStatus(item.status)} · {paymentStatus(item.paymentStatus)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {hasPasses ? (
                  <section aria-labelledby="passes-heading" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <h2 id="passes-heading" className="font-bold">参加証</h2>
                    <p className="mt-1 text-sm text-emerald-950/80">確定したイベントやクラスの参加証を表示できます。</p>
                    <Link href="/my/passes" className="mt-3 inline-block text-sm font-bold text-emerald-800 underline">参加証を見る →</Link>
                  </section>
                ) : null}

                {records.memberships.length > 0 ? (
                  <section aria-labelledby="memberships-heading">
                    <h2 id="memberships-heading" className="mb-3 text-base font-bold">メンバーシップ</h2>
                    <div className="space-y-3">
                      {records.memberships.map(item => (
                        <article key={item.id} className="rounded-2xl border border-neutral-200 p-4">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="mt-1 text-sm text-neutral-600">
                            {item.status === "active" ? "参加中" : "過去・停止中"} · {formatDate(item.joinedAt)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {noParticipation ? (
                  <p className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
                    申込や参加の記録はまだありません。申し込み後、参加中のクラスや参加証もここで確認できます。
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <section aria-labelledby="purchase-history-heading">
                  <h2 id="purchase-history-heading" className="mb-3 text-base font-bold">購入履歴</h2>
                  {records.purchases.length > 0 ? (
                    <div className="space-y-3">
                      {records.purchases.map(item => (
                        <article key={item.kind + ":" + item.id} className="rounded-2xl border border-neutral-200 p-4">
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-1 text-sm text-neutral-600">
                            {item.kind === "commerce" ? "作品・商品" : "有料申込"} · {item.status || "状態未確認"} · {item.amount ?? "—"} {item.currency ?? ""}
                          </p>
                          <p className="text-xs text-neutral-500">{formatDate(item.createdAt)}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">購入記録はまだありません。</p>
                  )}
                </section>

                <section aria-labelledby="purchased-works-heading">
                  <h2 id="purchased-works-heading" className="mb-3 text-base font-bold">購入した作品</h2>
                  {records.purchasedWorks.length > 0 ? (
                    <div className="space-y-3">
                      {records.purchasedWorks.map(item => (
                        <Link key={item.workId} href={"/p/" + item.workId} className="block rounded-2xl border border-neutral-200 p-4 hover:border-emerald-200 hover:bg-emerald-50">
                          <span className="block font-semibold">{item.title}</span>
                          <span className="mt-1 block text-xs text-neutral-500">{item.status}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">購入済みの作品はありません。</p>
                  )}
                </section>

                <Link href="/my/purchases" className="inline-block text-sm font-semibold text-emerald-800 underline">
                  定期購入の確認・解約
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
