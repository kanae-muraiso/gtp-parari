// src/app/mypage/page.tsx
// 2026/08/16 13:36

"use client";

import Link from "next/link";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";

// 必要なときだけ表示するお知らせ。
// 通常は空配列のまま。
const notices: Array<{
  id: string;
  title: string;
  message: string;
}> = [];

/*
例：

const notices = [
  {
    id: "maintenance-20260820",
    title: "メンテナンスのお知らせ",
    message:
      "8月20日 午前2時から3時までメンテナンスを行います。",
  },
];

*/


export default function MyPage() {
  

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

          {/* HEADER */}
          <MyAreaHeader title="Home" />


          {/* MAIN TABS */}
          <div className="mt-6">
            <MyPrimaryTabs active="home" />
          </div>


        {/* NOTICE AREA
            notices が空なら何も表示されず、高さも取りません。
        */}
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


        {/* HOME */}
        <div className="mt-8 space-y-10">

          {/* APPLICATION */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  参加・申し込み
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  あなたが申し込んだものを確認できます。
                </p>
              </div>

              <Link
                href="/my/applications"
                className="shrink-0 text-xs font-bold text-neutral-700"
              >
                見る →
              </Link>
            </div>
          </section>


          {/* BOOKSHELF */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  あなたの本棚
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  読むものは、本棚に集まります。
                </p>
              </div>

              <Link
                href="/my/bookshelf"
                className="shrink-0 text-xs font-bold text-neutral-700"
              >
                本棚を見る →
              </Link>
            </div>
          </section>

          {/* PUBLIC WORKS */}

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">

              <div>
                <div className="text-sm font-bold text-neutral-950">
                  公開作品
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  PARARIで公開された作品を探して読める機能を準備しています。
                </p>
              </div>

              <div className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-400">
                今後公開予定
              </div>

            </div>
          </section>
          

        </div>
      </div>
    </main>
  );
}
