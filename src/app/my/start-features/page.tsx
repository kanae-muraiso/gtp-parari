"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

type Feature = {
  title: string;
  description: string;
  href?: string;
  status?: string;
};

export default function StartFeaturesPage() {
  const { studioEnabled, hasApplications, hasClasses, hasSales, hasCalendar, loading } = useParariExperience();
  const [isMonitor, setIsMonitor] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || canceled) return;
      const { data } = await supabase.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle();
      if (!canceled) setIsMonitor(data?.is_monitor === true);
    }
    void load();
    return () => { canceled = true; };
  }, []);

  const features: Feature[] = [
    { title: "作品を書く", description: "PAGEやBOOKを作成します。", href: "/editor/quick", status: "利用可能" },
    { title: "電子書籍を作る", description: "編集画面でパネルセット「Kindle出版用」を選びます。ライターAの別登録は不要です。", href: "/editor/quick", status: "利用可能" },
    { title: "申込・イベント", description: "APPLICATIONでイベント・予約・申込受付を始めます。", href: "/my/manage?tab=application", status: hasApplications ? "利用中" : "新しく始める" },
    { title: "クラス", description: "教室やクラスを開設し、募集から運営まで管理します。", href: isMonitor ? "/my/manage?tab=class" : undefined, status: hasClasses ? "利用中" : isMonitor ? "新しく始める" : "一般公開準備中" },
    { title: "カレンダー", description: "日程を管理します。利用には対応プランが必要です。", href: hasCalendar ? "/my/manage?tab=calendar" : undefined, status: hasCalendar ? "利用中" : "対応プランで利用可能" },
    { title: "販売", description: "作品の販売設定や注文を管理します。", href: "/my/sales", status: hasSales ? "利用中" : "新しく始める" },
  ];

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="新しく始める" area="studio" navigation={<ManagementTabs active="start" embedded />} />
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h1 className="text-lg font-bold text-neutral-900">機能を選ぶ</h1>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            使っていない機能を普段のメニューに並べる必要はありません。ここから必要な機能を始められます。
            ライターAやクラスAのために別の無料会員プランを選び直す必要はありません。
          </p>
          {loading ? <p className="mt-4 text-sm text-neutral-500">利用状況を確認しています…</p> : null}
          {!studioEnabled && !loading ? <p className="mt-4 text-sm">まずは<Link className="underline" href="/my/start-studio">作品づくり</Link>から始めてください。</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map(feature => (
              <div key={feature.title} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">{feature.title}</h2>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600">{feature.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{feature.description}</p>
                {studioEnabled && feature.href ? (
                  <Link href={feature.href} className="mt-3 inline-flex rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                    {feature.status === "利用中" ? "開く" : "始める"}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
