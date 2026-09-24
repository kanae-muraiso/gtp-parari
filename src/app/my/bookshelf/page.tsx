// src/app/my/bookshelf/page.tsx
// 2026/09/15 JST

"use client";

import { useEffect, useState } from "react";

import BookShelfPanel from "@/components/parari/BookShelfPanel";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";
import BookshelfAnnouncements from "@/components/parari/announcements/BookshelfAnnouncements";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import { supabase } from "@/lib/supabaseClient";

type BookshelfMode = "mine" | "membership";

const BOOKSHELF_TABS = [
  { key: "mine", label: "マイ本棚" },
] as const;

const MEMBERSHIP_TAB = {
  key: "membership",
  label: "メンバーシップ",
} as const;

export default function MyBookshelfPage() {
  const [bookshelfMode, setBookshelfMode] = useState<BookshelfMode>("mine");
  const [hasMemberships, setHasMemberships] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMembershipAvailability() {
      if (!supabase) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (
        cancelled ||
        !session?.access_token
      ) {
        return;
      }

      try {
        const response = await fetch(
          "/api/my-memberships?summary=1",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              hasMemberships?: boolean;
            }
          | null;

        if (
          cancelled ||
          !response.ok ||
          !result?.ok
        ) {
          return;
        }

        const nextHasMemberships =
          result.hasMemberships === true;

        setHasMemberships(
          nextHasMemberships,
        );

        if (
          !nextHasMemberships &&
          bookshelfMode === "membership"
        ) {
          setBookshelfMode("mine");
        }
      } catch (error) {
        console.error(
          "[bookshelf] Membership availability load failed:",
          error,
        );
      }
    }

    void loadMembershipAvailability();

    return () => {
      cancelled = true;
    };
  }, [bookshelfMode]);

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
              onChange={(key) => setBookshelfMode(key as BookshelfMode)}
            />
          </div>

          {bookshelfMode === "mine" ? (
            <BookShelfPanel />
          ) : hasMemberships ? (
            <MembershipShelfPanel />
          ) : (
            <BookShelfPanel />
          )}
        </div>
      </div>
    </main>
  );
}
