// src/app/my/settings/page.tsx
// 2026-11-24 JST
// PART: Account settings and expandable STUDIO entry guidance.

"use client";

import Link from "next/link";

import SquareConnectionPanel from "@/components/parari/billing/SquareConnectionPanel";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";
import StudioCreateEntry from "@/components/parari/navigation/StudioCreateEntry";
import EnglishAuthoringSettings from "@/components/parari/settings/EnglishAuthoringSettings";
import StartDestinationPanel from "@/components/parari/settings/StartDestinationPanel";
import StudioPausePanel from "@/components/parari/settings/StudioPausePanel";

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

function SettingsGroup({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-neutral-950">{title}</h2>
            <p className="mt-1 text-xs leading-6 text-neutral-500">{description}</p>
          </div>
          <span className="shrink-0 text-sm text-neutral-400" aria-hidden="true">⌄</span>
        </div>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4">
        {children}
      </div>
    </details>
  );
}

function GuideStep({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <li className="space-y-1 pl-1">
      <h3 className="font-bold text-neutral-950">{title}</h3>
      <p className="leading-6 text-neutral-600">{children}</p>
      {action ? (
        <Link className="inline-block font-semibold text-sky-800 underline underline-offset-4" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </li>
  );
}

export default function SettingsHomePage() {
  const { studioEnabled, loading } = useParariExperience();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="設定" area="settings" />

        <div className="mx-auto mt-8 max-w-3xl space-y-3">
          <SettingsGroup
            title="アカウント"
            description="氏名などの基本情報と、利用中のプランを設定します。"
            defaultOpen
          >
            <SettingsCard
              title="基本設定"
              description="氏名や表示名など、アカウントの情報を設定します。"
              href="/my/profile?returnTo=/my/settings"
            />
            {!loading && studioEnabled ? (
              <SettingsCard
                title="プラン"
                description="現在のプランや利用できる機能を確認します。"
                href="/billing"
              />
            ) : null}
          </SettingsGroup>

          {!loading && studioEnabled ? (
            <>
              <SettingsGroup
                title="作品・公開"
                description="作品の発表方法や、作者としての見え方を設定します。"
              >
                <section aria-labelledby="publish-work" className="rounded-2xl border border-neutral-200 p-4">
                  <h3 id="publish-work" className="text-sm font-bold text-neutral-950">作品を発表する</h3>
                  <p className="mt-1 text-xs leading-6 text-neutral-600">
                    作品のURLを知らせる方法や、PARARIで見つけてもらうための設定を確認できます。
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-neutral-800">作品を読んでもらう方法を見る</summary>
                    <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm">
                      <GuideStep title="作品のURLを知らせる" action={{ label: "作品一覧でURLを確認する", href: "/my/works" }}>
                        作品を「限定公開」にして、URLをメッセージで送ったり、自分のサイトに載せたりできます。URLを知っている人なら誰でも読めます。
                      </GuideStep>
                      <GuideStep title="ユーザーネームを決める" action={{ label: "ユーザーネームを設定する", href: "/my/profile?returnTo=/my/settings" }}>
                        ユーザーネームを決めると、www.parari.app/あなたのユーザーネーム/ が公開ページのURLになります。初期設定では、公開作品の一覧が表示されます。
                      </GuideStep>
                      <GuideStep title="PARARIで作品を見つけてもらう" action={{ label: "作品の公開設定を開く", href: "/my/works" }}>
                        公開プロフィールに掲載した作品は、LIBRARYの「作品・作者を探す」で作品名から検索できます。
                      </GuideStep>
                      <GuideStep title="ファンになってもらう">
                        公開作品を読んだ人が「ファンになる」を押すと、その読者の本棚から、あなたの作品をまとめて見られるようになります。
                      </GuideStep>
                    </ol>
                    <Link className="mt-4 inline-block text-sm font-semibold text-sky-800 underline underline-offset-4" href="/my/profile/public">
                      公開プロフィールを編集する
                    </Link>
                  </details>
                </section>

                <SettingsCard
                  title="作者の書棚設定"
                  description="公開する作品の並び方や、作者としての掲載を設定します。"
                  href="/my/author-library-settings"
                />
              </SettingsGroup>

              <SettingsGroup
                title="販売・決済"
                description="販売者情報、Square接続、作品の販売管理をまとめています。"
              >
                <SettingsCard
                  title="販売者情報・特定商取引法・個人情報の取扱い"
                  description="有料販売に必要な表示を登録し、購入者に公開します。Square接続とは別に必要です。"
                  href="/my/settings/seller"
                />
                <SquareConnectionPanel />
              </SettingsGroup>
            </>
          ) : null}

          <SettingsGroup
            title={studioEnabled ? "STUDIOの利用" : "STUDIOを始める"}
            description={studioEnabled
              ? "起動時の画面や執筆支援、利用の休止を設定します。"
              : "作品づくりやクラス運営を始めるための環境です。"}
            defaultOpen={!loading && !studioEnabled}
          >
            {!loading && studioEnabled ? (
              <>
                <StartDestinationPanel />
                <EnglishAuthoringSettings />
                <StudioPausePanel />
              </>
            ) : !loading ? (
              <div className={`rounded-2xl border p-4 ${WORKSPACE_PALETTE.studio.header}`}>
                <p className="mb-4 text-sm leading-7 text-blue-950/80">
                  PARARIのSTUDIOは、作品をつくる人もクラスを開く人も使う、共通の制作・運営環境です。無料で利用を開始できます。
                </p>
                <StudioCreateEntry />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">利用できる設定を確認しています…</p>
            )}
          </SettingsGroup>
        </div>
      </div>
    </main>
  );
}
