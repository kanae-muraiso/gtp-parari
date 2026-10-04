// src/app/my/bookshelf/page.tsx
// 2026/09/15 JST

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";

import BookShelfPanel from "@/components/parari/BookShelfPanel";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";
import BookshelfAnnouncements from "@/components/parari/announcements/BookshelfAnnouncements";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";


type BookshelfMode = "mine" | "membership";

const BOOKSHELF_TABS = [
  { key: "mine", label: "マイ本棚" },
] as const;

const MEMBERSHIP_TAB = {
  key: "membership",
  label: "メンバーシップ",
} as const;

export default function MyBookshelfPage() {
  return <Suspense fallback={<main className="p-6" role="status">本棚を読み込んでいます…</main>}><MyBookshelfContent /></Suspense>;
}

function MyBookshelfContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { items, userId, loading, error, refresh } = useParticipations();
  const hasMemberships = items.some(item => item.key.startsWith("membership:"));
  const bookshelfMode: BookshelfMode = search.get("tab") === "membership" ? "membership" : "mine";
  const selectedId = search.get("membership");
  const selectTab = (key: string) => {
    const params = new URLSearchParams(search.toString());
    if (key === "membership") params.set("tab", "membership");
    else { params.delete("tab"); params.delete("membership"); }
    router.replace(`/my/bookshelf${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const bookshelfTabs =
    hasMemberships
      ? [
          ...BOOKSHELF_TABS,
          MEMBERSHIP_TAB,
        ]
      : [...BOOKSHELF_TABS];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="本棚" />

        <div className="mt-6">
          <MyPrimaryTabs active="bookshelf" />
        </div>

        <div className="mt-8">
          <BookshelfAnnouncements />

          <div className="mb-5">
            <div className="text-sm font-bold text-neutral-950">
              あなたの本棚
            </div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              読むものは、ここに集まります。
            </p>
          </div>

          <div className="mb-5">
            <ParariTabs
              items={bookshelfTabs}
              active={bookshelfMode}
              onChange={selectTab}
            />
          </div>

          {bookshelfMode === "mine" ? (
            <BookShelfPanel />
          ) : loading ? (
            <p role="status">参加先を確認しています…</p>
          ) : error ? (
            <p role="alert">{error} <button type="button" onClick={refresh} className="underline">再読み込み</button></p>
          ) : hasMemberships ? (
            <MembershipShelfPanel key={userId} selectedId={selectedId} />
          ) : (
            <p className="py-6 text-sm text-neutral-500">現在閲覧できるメンバーシップの本棚はありません。参加先メニューからホームをご確認ください。</p>
          )}
        </div>
      </div>
    </main>
  );
}
