// src/app/my/settings/page.tsx
// 2026/09/15 JST
//
// 設定画面も利用環境に応じて育つ。
// 読者には基本設定だけを見せ、STUDIOを有効にした人にだけ
// 制作・運営向けの設定を追加する。

"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import StartupDestinationPanel from "@/components/parari/settings/StartupDestinationPanel";
import StudioAccessPanel from "@/components/parari/settings/StudioAccessPanel";

type SettingsCardProps = {
  title: string;
  description: string;
  href: string;
};

function SettingsCard({ title, description, href }: SettingsCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-neutral-950">{title}</div>
          <p className="mt-1 text-xs leading-6 text-neutral-500">
            {description}
          </p>
        </div>
        <span className="shrink-0 text-sm text-neutral-400">→</span>
      </div>
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-1 pt-3 text-xs font-bold tracking-[0.16em] text-neutral-400">
      {children}
    </div>
  );
}

export default function SettingsHomePage() {
  const {
    studioEnabled,
    hasApplications,
    hasCalendar,
    hasMessages,
    loading,
  } = useParariExperience();

  const hasGrowingLibraryFeatures =
    hasApplications || hasCalendar || hasMessages;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="設定" showManagementLinks={false} />

        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          <SectionLabel>基本</SectionLabel>

          <SettingsCard
            title="プロフィール"
            description="氏名、表示名、ユーザーネームなどを設定します。"
            href="/my/profile?returnTo=/my/settings"
          />

          <SettingsCard
            title="表示"
            description="本棚や読書画面の見え方を調整します。"
            href="/display"
          />

          <SettingsCard
            title="プラン"
            description="現在のプランや利用できる機能を確認します。"
            href="/billing"
          />

          {!loading && hasGrowingLibraryFeatures ? (
            <>
              <SectionLabel>LIBRARY</SectionLabel>

              {hasApplications ? (
                <SettingsCard
                  title="申込"
                  description="これまでの申込と参加状況を確認します。"
                  href="/my/applications"
                />
              ) : null}

              {hasCalendar ? (
                <SettingsCard
                  title="カレンダー"
                  description="参加予定や自分の予定を確認します。"
                  href="/my/calendar"
                />
              ) : null}

              {hasMessages ? (
                <SettingsCard
                  title="メッセージ"
                  description="届いたメッセージとやり取りを確認します。"
                  href="/my/messages"
                />
              ) : null}
            </>
          ) : null}

          {!loading && studioEnabled ? (
            <>
              <SectionLabel>STUDIO</SectionLabel>

              <StartupDestinationPanel />

              <SettingsCard
                title="公開トップページ"
                description="STUDIOで公開するプロフィールや作品の入口を設定します。"
                href="/my/profile/public"
              />
            </>
          ) : null}

          <div className="pt-3">
            <StudioAccessPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
