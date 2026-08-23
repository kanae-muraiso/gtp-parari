// src/app/my/calendar/page.tsx
// 2026/08/20 JST
//
// PARARI 利用者用「カレンダー」
//
// 作者側のCALENDAR管理は /my/manage。
// ここは読者・参加者本人の予定を集約する場所。

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";


export default function MyCalendarPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="カレンダー" />

        <div className="mt-6">
          <MyPrimaryTabs active="calendar" />
        </div>

        <div className="mt-8">
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="max-w-2xl">
              <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
                CALENDAR
              </div>

              <h2 className="mt-3 text-xl font-bold text-neutral-950">
                あなたの予定が、ここに集まります。
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-600">
                予約したクラスやイベント、
                登録した先生の予定などを、
                ここでまとめて確認できるようになります。
              </p>

              <div className="mt-6 rounded-2xl bg-neutral-50 p-5">
                <div className="text-sm font-bold text-neutral-900">
                  表示予定
                </div>

                <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">
                  <div>・予約したクラス・イベント</div>
                  <div>・登録した先生の開催予定</div>
                  <div>・Membership内の予定</div>
                  <div>・申込や提出などの締切</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
