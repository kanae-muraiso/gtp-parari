// src/app/my/settings/page.tsx
// 2026/11/10 JST
// PART: Guide authors through publishing and selling a work.

"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import EnglishAuthoringSettings from "@/components/parari/settings/EnglishAuthoringSettings";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pt-2 text-[11px] font-bold tracking-[0.16em] text-neutral-400">
      {children}
    </div>
  );
}

export default function SettingsHomePage() {
  const { studioEnabled, loading } = useParariExperience();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="設定" area="settings" />

        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          <SectionTitle>基本</SectionTitle>

          <SettingsCard
            title="基本設定"
            description="氏名、表示名、ユーザーネームなどを設定します。"
            href="/my/profile?returnTo=/my/settings"
          />

          <SettingsCard
            title="プラン"
            description="現在のプランや利用できる機能を確認します。"
            href="/billing"
          />

          {!loading && studioEnabled ? (
            <>
              <section aria-labelledby="publish-work" className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h2 id="publish-work" className="text-sm font-bold text-neutral-950">作品を発表する</h2>
                <p className="mt-1 text-xs leading-6 text-neutral-600">
                  まずは作品のURLを知らせるだけで、読んでもらえます。
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-800">あなたの作品を読んでもらうには</summary>
                  <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm">
                    <GuideStep title="作品のURLを知らせる" action={{ label: "作品一覧でURLを確認する", href: "/my/works" }}>
                      作品を「限定公開」にして、URLをメッセージで送ったり、自分のサイトに載せたりできます。URLを知っている人なら誰でも読めます。
                    </GuideStep>
                    <GuideStep title="ユーザーネームを決める" action={{ label: "ユーザーネームを設定する", href: "/my/profile?returnTo=/my/settings" }}>
                      ユーザーネームを決めると、www.parari.app/あなたのユーザーネーム/ があなたの公開ページのURLになります。初期設定では、公開作品の一覧が表示されます。
                    </GuideStep>
                    <GuideStep title="PARARIで作品を見つけてもらう（整備中）" action={{ label: "作品の公開設定を開く", href: "/my/works" }}>
                      作品の公開範囲は作品一覧で変更できます。公開作品を「作者から探す」「作品から探す」ための機能は整備中です。
                    </GuideStep>
                    <GuideStep title="ファンになってもらう">
                      公開作品を読んだ人が「ファンになる」を押すと、その読者の本棚の「作者別」に、あなたの作品をまとめて見られる入口ができます。
                    </GuideStep>
                  </ol>
                  <Link className="mt-4 inline-block text-sm font-semibold text-sky-800 underline underline-offset-4" href="/my/profile/public">
                    公開プロフィールを編集する
                  </Link>
                </details>
              </section>

              <section aria-labelledby="sell-work" className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h2 id="sell-work" className="text-sm font-bold text-neutral-950">PARARIで販売する</h2>
                <p className="mt-1 text-xs leading-6 text-neutral-600">
                  Squareに登録済みなら、アカウントを接続するところから始められます。
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-800">販売を始める手順</summary>
                  <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm">
                    <GuideStep title="SquareアカウントをPARARIに接続する" action={{ label: "Squareの接続を開く", href: "/billing#square-connection" }}>
                      「Squareを接続」を押し、売上を受け取るSquareアカウントで連携を許可します。PARARIに戻ったら「Square接続済み」を確認します。
                    </GuideStep>
                    <GuideStep title="作品と価格を決めて販売を開始する" action={{ label: "販売する作品を選ぶ", href: "/my/sales" }}>
                      販売画面で作品を選び、商品名と価格を入力して「販売を開始」を押します。販売を始めると、作品本文は購入者限定になります。
                    </GuideStep>
                    <GuideStep title="購入ページのURLを知らせる">
                      販売画面の「商品」で「購入ページを見る」から表示を確認し、「URLをコピー」で読者に案内します。
                    </GuideStep>
                  </ol>
                </details>
              </section>
            </>
          ) : null}

          {!loading && studioEnabled ? (
            <>
              <SectionTitle>STUDIO</SectionTitle>

              <StartDestinationPanel />
              <EnglishAuthoringSettings />
            </>
          ) : null}

          {!loading && !studioEnabled ? (
            <>
              <SectionTitle>制作・運営</SectionTitle>
              <StudioAccessPanel />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
