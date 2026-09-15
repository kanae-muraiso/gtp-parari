// src/app/mypage/page.tsx
// 2026/09/15 JST

"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";

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
};

function HomeCard({ title, description, href, action }: HomeCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
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
          className="shrink-0 text-xs font-bold text-neutral-700 transition hover:text-neutral-950"
        >
          {action} →
        </Link>
      </div>
    </section>
  );
}

export default function MyPage() {
  const {
    hasApplications,
    hasCalendar,
    hasMessages,
    loading,
  } = useParariExperience();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="HOME" />

        <div className="mt-6">
          <MyPrimaryTabs active="home" />
        </div>

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

        <div className="mt-8">
          <p className="text-xs leading-6 text-neutral-400">
            PARARIでは、使った機能だけがLIBRARYに加わっていきます。
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <HomeCard
            title="あなたの本棚"
            description="読むもの、あとで読むもの、参加しているBOOKがここに集まります。"
            href="/my/bookshelf"
            action="本棚を見る"
          />

          {!loading && hasApplications ? (
            <HomeCard
              title="参加・申し込み"
              description="あなたが申し込んだものを確認できます。"
              href="/my/applications"
              action="見る"
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
