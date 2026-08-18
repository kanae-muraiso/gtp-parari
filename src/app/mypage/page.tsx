// src/app/mypage/page.tsx
// 2026/08/16 13:36

"use client";

import { useState } from "react";
import Link from "next/link";

import BookShelfPanel from "@/components/parari/BookShelfPanel";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";

const tabs = [
  {
    label: "HOME",
    href: "/mypage",
    description: "PARARIでのあなたの現在地です。",
  },
  {
    label: "申込",
    href: "/my/applications",
    description: "申し込んだ内容や現在の状態を確認します。",
  },
  {
    label: "本棚",
    href: "#bookshelf",
    description: "保存した作品や読みたい作品を開きます。",
  },
  {
    label: "作品",
    href: "/my/works",
    description: "自分の作品を作成・編集します。",
  },
] as const;


// 必要なときだけ表示するお知らせ。
// 通常は空配列のまま。
const notices: Array<{
  id: string;
  title: string;
  message: string;
}> = [];

/*
例：

const notices = [
  {
    id: "maintenance-20260820",
    title: "メンテナンスのお知らせ",
    message:
      "8月20日 午前2時から3時までメンテナンスを行います。",
  },
];

*/


export default function MyPage() {
  const [
    bookshelfMode,
    setBookshelfMode,
  ] = useState<
    "mine" | "membership"
  >("mine");

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              PARARI
            </div>

            <h1 className="mt-1 text-xl font-bold text-neutral-950">
              Home
            </h1>
          </div>

          <Link
            href="/my/profile"
            className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
          >
            プロフィール・設定
          </Link>
        </div>


          {/* MAIN TABS */}
          <nav className="mt-6 flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
            {tabs.map((tab) => {
              const isActive = tab.label === "HOME";

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  title={tab.description}
                  className={[
                    "rounded-xl px-4 py-2 text-xs font-bold transition",
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>


        {/* NOTICE AREA
            notices が空なら何も表示されず、高さも取りません。
        */}
        {notices.length > 0 ? (
          <div className="mt-5 space-y-2">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="rounded-2xl border border-neutral-300 bg-white px-5 py-4"
              >
                <div className="text-sm font-bold text-neutral-950">
                  {notice.title}
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-600">
                  {notice.message}
                </p>
              </div>
            ))}
          </div>
        ) : null}


        {/* HOME */}
        <div className="mt-8 space-y-10">

          {/* APPLICATION */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  参加・申し込み
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  あなたが申し込んだものを確認できます。
                </p>
              </div>

              <Link
                href="/my/applications"
                className="shrink-0 text-xs font-bold text-neutral-700"
              >
                見る →
              </Link>
            </div>
          </section>


          {/* BOOKSHELF */}
          <section
            id="bookshelf"
            className="scroll-mt-6"
          >
            <div className="mb-4">
              <div className="text-sm font-bold text-neutral-950">
                あなたの本棚
              </div>

              <p className="mt-1 text-xs leading-6 text-neutral-500">
                読むものは、ここに集まります。
              </p>
            </div>

          {/* BOOKSHELF MODE */}
          <div className="mb-5">
            <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setBookshelfMode("mine")
                }
                className={[
                  "rounded-xl px-4 py-2 text-xs font-bold transition",
                  bookshelfMode === "mine"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                ].join(" ")}
              >
                マイ本棚
              </button>

              <button
                type="button"
                onClick={() =>
                  setBookshelfMode(
                    "membership",
                  )
                }
                className={[
                  "rounded-xl px-4 py-2 text-xs font-bold transition",
                  bookshelfMode ===
                  "membership"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                ].join(" ")}
              >
                メンバーシップ
              </button>
            </div>
          </div>

          {bookshelfMode === "mine" ? (
            <BookShelfPanel activeTab="shelf" />
          ) : (
            <MembershipShelfPanel />
          )}
          </section>


          {/* WORKS */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  あなたの作品
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  書いたもの、作っているものはこちらです。
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  href="/my/works"
                  className="text-xs font-bold text-neutral-700"
                >
                  作品一覧 →
                </Link>

                <Link
                  href="/editor/new"
                  className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  ＋ 新しく作る
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
