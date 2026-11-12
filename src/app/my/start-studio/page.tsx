"use client";

import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import StudioCreateEntry from "@/components/parari/navigation/StudioCreateEntry";
import useParariExperience from "@/components/parari/hooks/useParariExperience";

export default function StartStudioPage() {
  const { studioEnabled, loading } = useParariExperience();

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="作品づくり" area="library" />

        <section className="mt-6 space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h1 className="text-lg font-bold text-neutral-900">作品をつくる</h1>
          <p className="text-sm leading-7 text-neutral-600">
            PARARIでは、文章や写真をまとめて自分の作品をつくれます。
            読むだけの方は、STUDIOを使う必要はありません。
          </p>
          {!loading && studioEnabled ? (
            <Link
              href="/my/works"
              className="inline-flex rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
            >
              STUDIOの作品リストへ
            </Link>
          ) : null}
          <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-7 text-neutral-700">
            <p className="font-semibold text-neutral-900">作品づくりはFreeから始められます</p>
            <p className="mt-1">
              まずは無料で作品を書いてみることができます。
              より多くの作品の制作・公開や、継続的な運営のための上位プランもあります。
              詳しい比較や契約の管理はSTUDIOを利用する際に確認できます。
            </p>
          </div>
          <StudioCreateEntry />
          <p className="text-xs leading-6 text-neutral-500">
            このページを開くだけではSTUDIOは有効になりません。
          </p>
          <Link
            href="/my/bookshelf"
            className="inline-block text-sm font-medium text-emerald-800 underline underline-offset-4"
          >
            LIBRARYの書棚に戻る
          </Link>
        </section>
      </div>
    </main>
  );
}
