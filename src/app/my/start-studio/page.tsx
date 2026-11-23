"use client";

import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import StudioCreateEntry from "@/components/parari/navigation/StudioCreateEntry";

export default function StartStudioPage() {
  return <main className="min-h-screen bg-white">
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <MyAreaHeader title="STUDIOを始める" area="library" />
      <section className="mt-6 space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
        <h1 className="text-xl font-bold text-neutral-900">STUDIOを始める</h1>
        <p className="text-sm leading-7 text-neutral-600">
          PARARIのSTUDIOは、作品をつくる人も、クラスを開く人も使う共通の制作・運営環境です。
          無料で利用を開始でき、何かを作成・保存する前からSTUDIOへ入れます。
        </p>
        <StudioCreateEntry />
        <Link href="/mypage" className="inline-block text-sm font-medium text-emerald-800 underline underline-offset-4">
          LIBRARY HOMEに戻る
        </Link>
      </section>
    </div>
  </main>;
}
