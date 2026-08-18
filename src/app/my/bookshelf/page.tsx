// src/app/my/bookshelf/page.tsx
// 2026/08/18 JST
//
// PARARI 利用者用「本棚」
//
// - マイ本棚
// - Membership棚
//
// タブUIは ParariTabs に統一。

"use client";

import { useState } from "react";

import BookShelfPanel from "@/components/parari/BookShelfPanel";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";

type BookshelfMode =
  | "mine"
  | "membership";

const BOOKSHELF_TABS = [
  {
    key: "mine",
    label: "マイ本棚",
  },
  {
    key: "membership",
    label: "メンバーシップ",
  },
];

export default function MyBookshelfPage() {
  const [
    bookshelfMode,
    setBookshelfMode,
  ] = useState<BookshelfMode>("mine");

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* HEADER */}
          <MyAreaHeader title="本棚" />

        {/* PRIMARY TABS */}
        <div className="mt-6">
          <MyPrimaryTabs active="bookshelf" />
        </div>

        {/* BOOKSHELF */}
        <div className="mt-8">
          <div className="mb-5">
            <div className="text-sm font-bold text-neutral-950">
              あなたの本棚
            </div>

            <p className="mt-1 text-xs leading-6 text-neutral-500">
              読むものは、ここに集まります。
            </p>
          </div>

          {/* BOOKSHELF TABS */}
          <div className="mb-5">
            <ParariTabs
              items={BOOKSHELF_TABS}
              active={bookshelfMode}
              onChange={(key) =>
                setBookshelfMode(
                  key as BookshelfMode,
                )
              }
            />
          </div>

          {bookshelfMode === "mine" ? (
            <BookShelfPanel activeTab="shelf" />
          ) : (
            <MembershipShelfPanel />
          )}
        </div>
      </div>
    </main>
  );
}
