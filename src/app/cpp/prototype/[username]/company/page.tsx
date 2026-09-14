"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function CppPrototypeCompanyPage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "kanae-muraiso";

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <PrototypeHeader username={username} mode="company" />

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <article className="space-y-6">
            <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex gap-5">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.75rem] bg-neutral-100 text-3xl font-bold text-neutral-300">KM</div>
                  <div>
                    <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP RESEARCHER PROFILE</div>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">村磯 鼎</h1>
                    <div className="mt-3 space-y-1 text-sm leading-6 text-neutral-600">
                      <div>研究者プロフィール・サンプル表示</div>
                      <div>博士 · 取得済</div>
                      <div>@{username}</div>
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">COMPANY VIEW / PROTOTYPE</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {['分子生物学','解剖学','細胞生物学'].map((item) => (
                  <span key={item} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{item}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['細胞・組織','分子機構','研究者キャリア'].map((item) => (
                  <span key={item} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700">{item}</span>
                ))}
              </div>
            </header>

            <PublicSection title="研究概要">
              <ResearchView title="研究概要のタイトル" lead="この位置に、研究者が最も企業に見てほしい研究テーマを表示します。背景・目的・方法・成果・今後の展開を、文章や画像、動画を交えて説明できます。" />
              <div className="my-6 border-t border-neutral-200" />
              <ResearchView title="第二の研究テーマ" lead="研究概要は最大3件まで登録でき、研究者本人が優先順位を変更できます。企業側にはその順番で表示されます。" />
            </PublicSection>

            <PublicSection title="研究成果・論文">
              <ol className="space-y-5 text-sm leading-7 text-neutral-700">
                <li>
                  <div className="font-semibold text-neutral-950">論文タイトルの例</div>
                  <div>Muraiso K, et al.</div>
                  <div className="text-neutral-500">Journal Name · 2025 · Vol. 12 · pp. 100-110</div>
                  <div className="mt-1 text-xs text-neutral-500">DOI: 10.xxxx/example</div>
                </li>
                <li>
                  <div className="font-semibold text-neutral-950">研究成果のタイトル例</div>
                  <div>Research Group</div>
                  <div className="text-neutral-500">Conference / Journal · 2024</div>
                </li>
              </ol>
            </PublicSection>

            <PublicSection title="学歴・職歴">
              <div className="grid gap-8 md:grid-cols-2">
                <HistoryList title="学歴" items={[
                  ['1978/04/01','東京大学 入学'],
                  ['1982/03/31','東京大学 卒業'],
                ]} />
                <HistoryList title="職歴" items={[
                  ['1982/04/01','研究活動を開始'],
                  ['1987/01/01','NIH 留学'],
                ]} />
              </div>
            </PublicSection>

            <PublicSection title="自己アピール">
              <p className="text-sm leading-8 text-neutral-700">
                ここには研究者本人が自由に自己紹介・自己アピールを記載します。研究テーマだけでは伝わりにくい、問題の捉え方、仕事の進め方、企業と取り組みたいことなどを表現できます。
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="flex min-h-44 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-semibold text-neutral-400">IMAGE</div>
                <div className="flex min-h-44 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-950 text-sm font-semibold text-white">YouTube</div>
              </div>
            </PublicSection>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">COMPANY ACTION</div>
              <h2 className="mt-2 text-base font-bold text-neutral-950">この研究者に興味がありますか？</h2>
              <p className="mt-2 text-xs leading-5 text-neutral-500">本番では企業アカウントから候補保存やコンタクトにつなげます。</p>
              <button type="button" className="mt-5 w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-bold text-white">候補に保存（見本）</button>
              <button type="button" className="mt-2 w-full rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-800">メッセージを送る（見本）</button>
            </div>

            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-neutral-950">企業向けメモ</div>
              <p className="mt-2 text-xs leading-6 text-neutral-500">
                メールアドレス・電話番号・住所などの非公開情報は、この画面には表示されません。
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function PrototypeHeader({ username, mode }: { username: string; mode: 'workbook' | 'company' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-3">
        <Link href={`/cpp/prototype/${username}`} className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP</Link>
        <span className="text-xs text-neutral-400">@{username}</span>
      </div>
      <div className="flex rounded-full border border-neutral-300 bg-white p-1 text-xs font-bold">
        <Link href={`/cpp/prototype/${username}/workbook`} className={`rounded-full px-4 py-2 ${mode === 'workbook' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>研究者入力</Link>
        <Link href={`/cpp/prototype/${username}/company`} className={`rounded-full px-4 py-2 ${mode === 'company' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>企業表示</Link>
      </div>
    </div>
  );
}

function PublicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-5 text-xl font-bold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function ResearchView({ title, lead }: { title: string; lead: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-neutral-950">{title}</h3>
      <p className="mt-3 text-sm leading-8 text-neutral-700">{lead}</p>
      <div className="mt-5 flex min-h-40 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-semibold text-neutral-400">研究画像 / 図表</div>
      <button type="button" className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800">研究資料.pdf を見る（見本）</button>
    </div>
  );
}

function HistoryList({ title, items }: { title: string; items: string[][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      <ol className="mt-4 space-y-4">
        {items.map(([date, text]) => (
          <li key={`${date}-${text}`} className="grid grid-cols-[100px_1fr] gap-3 text-sm leading-6 text-neutral-700">
            <div className="text-xs font-semibold text-neutral-400">{date}</div>
            <div>{text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
