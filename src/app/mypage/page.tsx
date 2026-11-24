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
import ClassHomeShortcuts from "@/components/parari/navigation/ClassHomeShortcuts";
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
    hasApplications,
    hasCalendar,
    hasMessages,
    loading,
    studioEnabled,
  } = useParariExperience();

  const [
    hasPasses,
    setHasPasses,
  ] = useState(false);
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

  useEffect(() => {
    if (
      loading ||
      !hasApplications ||
      !supabase
    ) {
      if (!hasApplications) {
        setHasPasses(false);
      }
      return;
    }

    let cancelled = false;

    async function loadPassAvailability() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (
        cancelled ||
        !session?.access_token
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            "/api/application/my-passes?summary=1",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                hasPasses?: boolean;
              }
            | null;

        if (
          cancelled ||
          !response.ok ||
          !result?.ok
        ) {
          return;
        }

        setHasPasses(
          result.hasPasses === true,
        );
      } catch (error) {
        console.error(
          "[LIBRARY HOME] pass availability load failed:",
          error,
        );
      }
    }

    void loadPassAvailability();

    return () => {
      cancelled = true;
    };
  }, [
    hasApplications,
    loading,
  ]);

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
          <section aria-labelledby="open-space-heading" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="open-space-heading" className="text-base font-bold text-emerald-950">
                PARARIオープンスペース（仮称）
              </h2>
              <span className="text-xs font-semibold text-emerald-800">準備中</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-emerald-950/80">
              作品や作者との出会いを広げる、新しい入口を準備しています。
            </p>
          </section>

          <HomeCard
            title="あなたの本棚"
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

          <ClassHomeShortcuts studioEnabled={studioEnabled} />

          {!loading && hasApplications ? (
            <HomeCard
              title="参加・申し込み"
              description="あなたが申し込んだものを確認できます。"
              href="/my/applications"
              action="見る"
            />
          ) : null}

          {!loading && hasPasses ? (
            <HomeCard
              title="参加証"
              description="確定したイベントやクラスのQR参加証をいつでも表示できます。"
              href="/my/passes"
              action="参加証を見る"
            />
          ) : null}

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
