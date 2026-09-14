// src/app/cpp/sample-profile/page.tsx
// CPP researcher profile sample for staff review
// 2026-09-14

export default function CppSampleProfilePage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4 px-1">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP</div>
            <div className="mt-1 text-sm font-semibold text-neutral-700">RESEARCHER PROFILE</div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
            SAMPLE
          </span>
        </div>

        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[160px_1fr] sm:items-start">
            <div className="flex aspect-square items-center justify-center rounded-[2rem] bg-neutral-100 text-5xl font-bold text-neutral-300">
              YS
            </div>

            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                CPP RESEARCHER PROFILE
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
                山田 さくら
              </h1>

              <div className="mt-4 space-y-1 text-sm leading-6 text-neutral-600">
                <div>京都未来大学 生命科学研究科</div>
                <div>博士研究員</div>
                <div>
                  <span className="font-semibold text-neutral-800">博士（生命科学）</span>
                  <span> · 京都未来大学 · 2025/03/25 取得</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                  分子生物学
                </span>
                <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                  細胞生物学
                </span>
                <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                  ゲノム生物学
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['RNA修飾', 'single-cell', 'CRISPR', 'がん微小環境'].map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <SampleSection title="研究概要">
          <div className="space-y-7">
            <ResearchSummary
              title="RNA修飾が細胞分化を制御する仕組み"
              lead="RNAの化学修飾が、細胞の運命決定にどのように関わるかを研究しています。"
            >
              <p>
                細胞内では、RNAは単にDNAの情報を運ぶだけではなく、さまざまな化学修飾を受けながら働いています。私は、特定のRNA修飾酵素を操作した細胞を用いて、遺伝子発現の変化と細胞分化の関係を解析しています。
              </p>
              <p>
                現在はsingle-cell解析とイメージングを組み合わせ、同じ細胞集団の中で生じる不均一性に注目しています。
              </p>
            </ResearchSummary>

            <ResearchSummary
              title="がん微小環境における細胞間コミュニケーション"
              lead="腫瘍細胞と周囲の免疫細胞・間質細胞の相互作用を解析しています。"
            >
              <p>
                培養系と公開オミックスデータを組み合わせ、腫瘍周辺で生じるシグナル伝達のネットワークを調べています。基礎研究だけでなく、疾患理解につながる研究テーマとして発展させたいと考えています。
              </p>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                研究資料PDFを添付できます
              </div>
            </ResearchSummary>

            <ResearchSummary
              title="新しい解析手法の開発"
              lead="実験データと計算解析を行き来できる研究環境づくりにも取り組んでいます。"
            >
              <p>
                実験研究者自身がデータ解析を行いやすくするため、解析手順の標準化や可視化ツールの作成も行っています。
              </p>
            </ResearchSummary>
          </div>
        </SampleSection>

        <SampleSection title="研究成果・論文">
          <ol className="space-y-5">
            <Publication
              title="RNA modification controls cell-state transition in human stem cells"
              authors="Sakura Yamada, Haruki Sato, Mei Tanaka"
              venue="Journal of Molecular Cell Biology · 2026 · Vol. 18 · pp. 120–134"
              doi="10.0000/example.2026.001"
            />
            <Publication
              title="Single-cell analysis of tumor-associated stromal interactions"
              authors="Sakura Yamada, Koji Nakamura"
              venue="Cell Systems Research · 2025 · Vol. 12 · pp. 88–101"
              doi="10.0000/example.2025.014"
            />
          </ol>
        </SampleSection>

        <SampleSection title="学歴・職歴">
          <div className="grid gap-8 md:grid-cols-2">
            <HistoryList
              title="学歴"
              rows={[
                ['2017/04/01', '京都未来大学 理学部 入学'],
                ['2021/03/25', '京都未来大学 理学部 卒業'],
                ['2021/04/01', '京都未来大学大学院 生命科学研究科 修士課程 入学'],
                ['2023/04/01', '京都未来大学大学院 生命科学研究科 博士課程 入学'],
                ['2025/03/25', '博士（生命科学）取得'],
              ]}
            />
            <HistoryList
              title="職歴"
              rows={[
                ['2025/04/01', '京都未来大学 生命科学研究科 博士研究員'],
                ['2026/04/01', '同研究科 特任研究員'],
              ]}
            />
          </div>
        </SampleSection>

        <SampleSection title="自己アピール">
          <div className="space-y-5 text-sm leading-7 text-neutral-700">
            <p>
              分子生物学の実験を中心に研究してきましたが、single-cell解析をきっかけにPythonやRを使ったデータ解析にも取り組むようになりました。実験と計算の両方を理解し、異なる専門を持つ人の間をつなぐ役割を得意としています。
            </p>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950">
              <div className="flex aspect-video items-center justify-center text-center text-white">
                <div>
                  <div className="text-4xl">▶</div>
                  <div className="mt-3 text-sm font-semibold">YouTube自己紹介・研究紹介動画</div>
                  <div className="mt-1 text-xs text-neutral-400">実際のプロフィールでは動画を埋め込めます</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-400">
                研究画像
              </div>
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-400">
                発表・活動写真
              </div>
            </div>
          </div>
        </SampleSection>

        <footer className="pb-8 pt-2 text-center text-xs leading-6 text-neutral-400">
          <div>CPP Researcher Profile — Sample</div>
          <div>このページの氏名・所属・研究内容はすべて架空です。</div>
        </footer>
      </article>
    </main>
  );
}

function SampleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-5 text-xl font-bold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function ResearchSummary({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-200 pb-7 last:border-b-0 last:pb-0">
      <h3 className="text-lg font-bold text-neutral-950">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-7 text-neutral-600">{lead}</p>
      <div className="mt-4 space-y-4 text-sm leading-7 text-neutral-700">{children}</div>
    </div>
  );
}

function Publication({
  title,
  authors,
  venue,
  doi,
}: {
  title: string;
  authors: string;
  venue: string;
  doi: string;
}) {
  return (
    <li className="text-sm leading-7 text-neutral-700">
      <div className="font-semibold text-neutral-950">{title}</div>
      <div className="mt-1">{authors}</div>
      <div className="mt-1 text-neutral-500">{venue}</div>
      <div className="mt-1 text-xs text-neutral-400">DOI: {doi}</div>
    </li>
  );
}

function HistoryList({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      <ol className="mt-4 space-y-4">
        {rows.map(([date, text]) => (
          <li key={`${date}-${text}`} className="grid grid-cols-[100px_1fr] gap-3 text-sm leading-6 text-neutral-700">
            <div className="text-xs font-semibold text-neutral-400">{date}</div>
            <div>{text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
