"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getCompanyExample } from "@/lib/cpp/companyExamples";

const toneClasses = [
  "from-sky-50 to-white",
  "from-emerald-50 to-white",
  "from-violet-50 to-white",
  "from-amber-50 to-white",
  "from-rose-50 to-white",
];

export default function CppCompanyExampleDetailPage() {
  const params = useParams<{ slug: string }>();
  const example = getCompanyExample(params.slug);

  if (!example) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-neutral-950">完成見本が見つかりません</h1>
          <Link href="/cpp/company/examples" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">一覧へ戻る</Link>
        </div>
      </main>
    );
  }

  const tone = toneClasses[(example.typeNo - 1) % toneClasses.length];

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-xs font-semibold text-white">
          <span>CPP COMPANY 完成見本 · 架空企業です</span>
          <Link href="/cpp/company/examples" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">← 5つの見本へ</Link>
        </div>

        <header className={`overflow-hidden rounded-[2.2rem] border border-neutral-200 bg-gradient-to-br ${tone} p-7 shadow-sm sm:p-10`}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-4xl">
              <div className="text-xs font-black tracking-[0.2em] text-neutral-400">TYPE {example.typeNo} · {example.typeLabel}</div>
              <div className="mt-7 text-xs font-bold tracking-[0.18em] text-neutral-500">{example.accentWord}</div>
              <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-neutral-950 sm:text-5xl">{example.heroTitle}</h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-neutral-700">{example.heroLead}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 text-right shadow-sm backdrop-blur">
              <div className="text-xs font-semibold text-neutral-400">SAMPLE COMPANY</div>
              <div className="mt-1 text-lg font-bold text-neutral-950">{example.companyName}</div>
              <div className="mt-1 text-[11px] tracking-wide text-neutral-400">{example.companyNameEn}</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-neutral-600">
            <span className="rounded-full bg-white/80 px-3 py-1.5">{example.industry}</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5">{example.location}</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">この型が向く会社</div>
              <p className="mt-3 text-sm leading-7 text-neutral-700">{example.recommendedFor}</p>
            </div>
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">構成の考え方</div>
              <p className="mt-3 text-sm leading-7 text-neutral-700">{example.typeDescription}</p>
            </div>
          </aside>

          <div className="space-y-5">
            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">{example.openingLabel}</div>
              <div className="mt-5 space-y-8">
                {example.sections.map((section, index) => (
                  <article key={`${section.title}-${index}`} className={index === 0 ? "" : "border-t border-neutral-200 pt-8"}>
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-950">{section.title}</h2>
                    {section.lead ? <p className="mt-3 text-base font-semibold leading-7 text-neutral-700">{section.lead}</p> : null}
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="mt-4 text-sm leading-7 text-neutral-650 text-neutral-700">{paragraph}</p>
                    ))}
                    {section.bullets ? (
                      <ul className="mt-5 space-y-3">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-3 text-sm leading-7 text-neutral-700">
                            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.stats ? (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {section.stats.map((stat) => (
                          <div key={stat.label} className="rounded-2xl bg-neutral-50 p-4">
                            <div className="text-xs font-semibold text-neutral-400">{stat.label}</div>
                            <div className="mt-1 text-xl font-black text-neutral-950">{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">RECRUITMENT</div>
                  <h2 className="mt-2 text-2xl font-bold text-neutral-950">募集情報</h2>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-500">SAMPLE</span>
              </div>

              <div className="mt-6 space-y-7">
                {example.recruitments.map((recruitment, index) => (
                  <article key={recruitment.title} className={index === 0 ? "" : "border-t border-neutral-200 pt-7"}>
                    <h3 className="text-xl font-bold text-neutral-950">{recruitment.title}</h3>
                    {recruitment.subtitle ? <div className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">{recruitment.subtitle}</div> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recruitment.tags.map((tag) => <span key={tag} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">{tag}</span>)}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-neutral-700">{recruitment.summary}</p>
                    <dl className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-5 sm:grid-cols-2">
                      {recruitment.details.map((detail) => (
                        <div key={detail.label}>
                          <dt className="text-xs font-bold text-neutral-400">{detail.label}</dt>
                          <dd className="mt-1 text-sm font-semibold text-neutral-800">{detail.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] bg-neutral-900 p-7 text-white shadow-sm sm:p-9">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">MESSAGE TO RESEARCHERS</div>
              <p className="mt-4 text-lg font-semibold leading-8">{example.closingMessage}</p>
            </section>
          </div>
        </section>

        <section className="rounded-[2rem] border border-dashed border-neutral-300 bg-white p-6 text-sm leading-7 text-neutral-600 sm:p-8">
          <div className="font-bold text-neutral-950">このページをそのまま入力させるわけではありません。</div>
          <p className="mt-2">
            企業にはこの完成形を見てもらい、「この型から始める」を選択してもらいます。選択後は、見出しやブロックを自由に追加・削除・並べ替えできる入力画面にします。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-neutral-200 px-5 py-2.5 text-sm font-bold text-neutral-500">このひな形で作る（次に実装）</span>
            <Link href="/cpp/company/examples" className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-700">別の型を見る</Link>
          </div>
        </section>

        <footer className="pb-8 text-center text-xs text-neutral-400">CPP COMPANY EXAMPLE · FICTIONAL COMPANY</footer>
      </div>
    </main>
  );
}
