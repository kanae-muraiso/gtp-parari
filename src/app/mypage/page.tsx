// src/app/mypage/page.tsx
// 2026-11-24 JST
// PART: LIBRARY home panels and per-user Studio guidance dismissal.

"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";
import { supabase } from "@/lib/supabaseClient";

const notices: Array<{
  id: string;
  title: string;
  message: string;
}> = [];

type HomeCardProps = {
  title: string;
  description: string;
  href: string;
  action: string;
  onDismiss?: () => void;
  dismissing?: boolean;
  dismissError?: string;
  studio?: boolean;
};

function HomeCard({
  title,
  description,
  href,
  action,
  onDismiss,
  dismissing = false,
  dismissError,
  studio = false,
}: HomeCardProps) {
  return (
    <section className={`rounded-2xl border p-5 ${studio ? WORKSPACE_PALETTE.studio.header : "border-neutral-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-neutral-950">
            {title}
          </div>
          <p className="mt-1 text-xs leading-6 text-neutral-500">
            {description}
          </p>
        </div>

        <Link
          href={href}
          className={`shrink-0 text-xs font-bold transition ${studio ? "text-blue-800 hover:text-blue-950" : "text-emerald-800 hover:text-emerald-950"}`}
        >
          {action} →
        </Link>
      </div>
      {onDismiss ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissing}
            aria-label="STUDIOの案内を非表示にする"
            title="この案内を今後表示しない"
            className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50"
          >
            {dismissing ? "保存中…" : "この案内を今後表示しない"}
          </button>
          {dismissError ? <p role="alert" className="mt-2 text-xs text-rose-700">{dismissError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function MyPage() {
  const {
    hasCalendar,
    hasMessages,
    loading,
    studioEnabled,
  } = useParariExperience();

  const [studioCardDismissed, setStudioCardDismissed] = useState(false);
  const [studioCardPreferenceLoaded, setStudioCardPreferenceLoaded] = useState(false);
  const [dismissingStudioCard, setDismissingStudioCard] = useState(false);
  const [studioCardDismissError, setStudioCardDismissError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStudioCardPreference() {
      if (!supabase) {
        setStudioCardPreferenceLoaded(true);
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !user) {
        setStudioCardPreferenceLoaded(true);
        return;
      }

      setStudioCardDismissed(user.user_metadata?.studio_start_card_dismissed === true);
      setStudioCardPreferenceLoaded(true);
    }

    void loadStudioCardPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismissStudioCard() {
    if (!supabase || dismissingStudioCard) return;
    setDismissingStudioCard(true);
    setStudioCardDismissError("");

    const { error } = await supabase.auth.updateUser({
      data: { studio_start_card_dismissed: true },
    });

    if (error) {
      console.error("[LIBRARY HOME] Studio card dismissal save failed:", error);
      setStudioCardDismissError("非表示設定を保存できませんでした。もう一度お試しください。");
      setDismissingStudioCard(false);
      return;
    }

    setStudioCardDismissed(true);
    setDismissingStudioCard(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="HOME" area="library" navigation={<MyPrimaryTabs active="home" embedded />} />

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

        <div className="mt-6 space-y-4">
          <HomeCard
            title="オープンスペース"
            description="公開されている作品や作者を探せます。"
            href="/my/authors"
            action="作品・作者を探す"
          />

          <HomeCard
            title="本棚"
            description="読むもの、あとで読むもの、参加しているBOOKがここに集まります。"
            href="/my/bookshelf"
            action="本棚を見る"
          />

          {!loading && !studioEnabled && studioCardPreferenceLoaded && !studioCardDismissed ? (
            <HomeCard
              title="STUDIOを無料で始める"
              description="作品を作る・クラスを開く。作品を先に保存しなくても利用開始できます。"
              href="/my/start-studio"
              action="STUDIOを始める"
              onDismiss={() => void dismissStudioCard()}
              dismissing={dismissingStudioCard}
              dismissError={studioCardDismissError}
              studio
            />
          ) : null}

          <HomeCard
            title="参加・購入"
            description="申込状況、参加中のクラス、参加証、購入した作品をまとめて確認できます。"
            href="/my/bookshelf/records?tab=participation"
            action="まとめて見る"
          />

          {!loading && hasCalendar ? (
            <HomeCard
              title="カレンダー"
              description="参加予定や、自分で登録した予定を確認できます。"
              href="/my/calendar"
              action="予定を見る"
            />
          ) : null}

          {!loading && hasMessages ? (
            <HomeCard
              title="メッセージ"
              description="PARARIでつながった相手とのメッセージを確認できます。"
              href="/my/messages"
              action="開く"
            />
          ) : null}
        </div>

      </div>
    </main>
  );
}
