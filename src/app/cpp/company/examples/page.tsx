import Link from "next/link";
import { COMPANY_EXAMPLES } from "@/lib/cpp/companyExamples";

export default function CppCompanyExamplesPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP COMPANY EXAMPLES</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">博士に会社をどう伝えるか。</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600 sm:text-base">
            会社案内に正解は一つではありません。CPPでは、過去の企業資料を参考に、伝え方の違う5つの完成見本を用意しました。
            自社に近いものを一つ選び、そこから自由に変えていけます。
          </p>
          <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            ここに掲載している会社名・数値・募集内容は、すべて説明用に作成した架空のものです。
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {COMPANY_EXAMPLES.map((example) => (
            <Link
              key={example.slug}
              href={`/cpp/company/examples/${example.slug}`}
              className="group rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">TYPE {example.typeNo}</div>
                  <h2 className="mt-2 text-xl font-bold text-neutral-950">{example.typeLabel}</h2>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-500">完成見本</span>
              </div>

              <p className="mt-4 text-sm leading-7 text-neutral-600">{example.typeDescription}</p>

              <div className="mt-5 rounded-2xl bg-neutral-50 p-5">
                <div className="text-xs font-semibold text-neutral-400">架空企業</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">{example.companyName}</div>
                <div className="mt-2 text-xs leading-5 text-neutral-500">{example.industry} · {example.location}</div>
              </div>

              <div className="mt-5 text-sm font-bold text-neutral-900 group-hover:underline group-hover:underline-offset-4">この完成見本を見る →</div>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] border border-neutral-200 bg-white p-6 text-sm leading-7 text-neutral-600 shadow-sm sm:p-8">
          <div className="font-bold text-neutral-900">ひな形は型にはめるためではありません。</div>
          <p className="mt-2">
            5つの見本は、実際のCOMPANY WORKBOOKと同じデータ構造・同じページ描画機能で表示しています。
            どの見本から始めても、研究紹介、PDF、画像、YouTube、募集ポジションを追加・削除し、順番や表示方法を変えられます。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/cpp/company/try" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">企業登録へ</Link>
            <Link href="/my/cpp/company/layout" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700">5つのひな形を選ぶ</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
