// src/app/my/settings/page.tsx
// 2026/09/15 JST

"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import StartDestinationPanel from "@/components/parari/settings/StartDestinationPanel";
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
          <div className="text-sm font-bold text-neutral-950">
            {title}
          </div>
          <p className="mt-1 text-xs leading-6 text-neutral-500">
            {description}
          </p>
        </div>
        <span className="shrink-0 text-sm text-neutral-400">→</span>
      </div>
    </Link>
  );
}

export default function SettingsHomePage() {
  const { studioEnabled, loading } = useParariExperience();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="設定" showManagementLinks={false} />

        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          <SettingsCard
            title="基本設定"
            description="氏名、表示名、ユーザーネームなどを設定します。"
            href="/my/profile?returnTo=/my/settings"
          />

          <SettingsCard
            title="表示設定"
            description="本棚や読書画面の見え方を調整します。"
            href="/display"
          />

          <SettingsCard
            title="プラン"
            description="現在のプランや利用できる機能を確認します。"
            href="/billing"
          />

          {!loading && studioEnabled ? (
            <>
              <StartDestinationPanel />

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
