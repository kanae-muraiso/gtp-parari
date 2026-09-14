"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const inputClass =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-neutral-500";

export default function CppPrototypeWorkbookPage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "kanae-muraiso";

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <PrototypeHeader username={username} mode="workbook" />

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP WORKBOOK</div>
              <h1 className="mt-2 text-2xl font-bold text-neutral-950">研究者プロフィールを作る</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                少しずつ入力して構いません。このページは画面確認用のプロトタイプなので、入力内容は保存されません。
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">PROTOTYPE</span>
          </div>
        </section>

        <Section title="基本情報" description="公開名・所属・学位など。連絡先は一般には公開されません。">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="公開名" defaultValue="村磯 鼎" />
            <Field label="現在の所属" defaultValue="所属機関名" />
            <Field label="役職・立場" defaultValue="研究員 / 博士研究員など" />
            <Field label="メールアドレス（非公開・必須）" defaultValue="example@example.jp" />
            <Field label="電話番号（非公開・必須）" defaultValue="090-0000-0000" />
            <Field label="住所（非公開・必須）" defaultValue="京都府京都市…" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectLike label="最終学位" value="博士" />
            <SelectLike label="状態" value="取得済" />
            <Field label="取得場所" defaultValue="○○大学" />
            <Field label="取得年月日" defaultValue="2020-03-25" type="date" />
          </div>
        </Section>

        <Section title="研究分野" description="JREC-INの研究分野から複数選択します。">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <SelectLike label="大分類" value="ライフサイエンス" />
            <SelectLike label="研究分野" value="分子生物学" />
            <button type="button" className="mt-6 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
              追加
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['分子生物学','解剖学','細胞生物学'].map((item) => (
              <span key={item} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">{item} ×</span>
            ))}
          </div>
        </Section>

        <Section title="キーワード" description="企業が自由語で研究者を探すための言葉です。">
          <div className="flex gap-2">
            <input className={inputClass} defaultValue="細胞・組織" />
            <button type="button" className="rounded-full border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-800">追加</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['細胞・組織','分子機構','研究者キャリア'].map((item) => (
              <span key={item} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">{item} ×</span>
            ))}
          </div>
        </Section>

        <Section title="学歴" description="年月日で古い順に自動整列されます。">
          <HistoryMock date="1978-04-01" text="東京大学 入学" />
          <HistoryMock date="1982-03-31" text="東京大学 卒業" />
          <button type="button" className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">＋学歴を追加</button>
        </Section>

        <Section title="職歴" description="1項目は『年月日＋事柄』だけで入力します。">
          <HistoryMock date="1982-04-01" text="研究活動を開始" />
          <HistoryMock date="1987-01-01" text="NIH 留学" />
          <button type="button" className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">＋職歴を追加</button>
        </Section>

        <Section title="研究概要" description="最大3件。上にある研究ほど企業画面で先に表示されます。">
          <ResearchMock number={1} title="研究概要のタイトル" body="研究の背景、目的、方法、分かったこと、今後の展開などを自由に記入します。" />
          <ResearchMock number={2} title="第二の研究テーマ" body="複数の研究テーマがある場合は、優先度順に並べ替えられます。" />
          <button type="button" className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">＋研究概要を追加</button>
        </Section>

        <Section title="研究成果・論文" description="まずは手入力。後から外部データ取り込みを追加できます。">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="論文タイトル" defaultValue="論文タイトルの例" />
            <Field label="著者" defaultValue="Muraiso K, et al." />
            <Field label="掲載誌" defaultValue="Journal Name" />
            <Field label="年" defaultValue="2025" />
            <Field label="DOI" defaultValue="10.xxxx/example" />
            <Field label="外部URL" defaultValue="https://example.com" />
          </div>
          <button type="button" className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">＋論文を追加</button>
        </Section>

        <Section title="自己アピール" description="文章だけでなく、画像やYouTubeも使える想定です。">
          <div className="rounded-2xl border border-neutral-300 bg-white p-4">
            <textarea
              className="min-h-36 w-full resize-y border-0 bg-transparent text-sm leading-7 text-neutral-700 outline-none"
              defaultValue="研究内容だけでなく、自分がどのような問題を考え、どのように仕事を進める人なのかを自由に伝えます。"
            />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
              <button type="button" className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700">＋画像</button>
              <button type="button" className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700">＋YouTube</button>
            </div>
          </div>
        </Section>

        <section className="rounded-[2rem] border border-neutral-900 bg-neutral-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">PUBLICATION</div>
              <h2 className="mt-2 text-xl font-bold">プロフィールを公開する</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-300">
                本番では必須情報を確認してから公開します。このプロトタイプでは何も公開されません。
              </p>
            </div>
            <button type="button" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-neutral-950">公開する（見本）</button>
          </div>
        </section>
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

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-neutral-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-neutral-600">{label}</span>
      <input type={type} className={inputClass} defaultValue={defaultValue} />
    </label>
  );
}

function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-neutral-600">{label}</span>
      <select className={inputClass} defaultValue={value}>
        <option>{value}</option>
      </select>
    </label>
  );
}

function HistoryMock({ date, text }: { date: string; text: string }) {
  return (
    <div className="mb-3 grid gap-3 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-[180px_1fr_auto]">
      <input type="date" className={inputClass} defaultValue={date} />
      <input className={inputClass} defaultValue={text} />
      <button type="button" className="px-2 text-xs font-bold text-neutral-400">削除</button>
    </div>
  );
}

function ResearchMock({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="mb-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{number}</span>
          <span className="text-sm font-bold text-neutral-900">研究概要 {number}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700">↑ 上へ</button>
          <button type="button" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700">↓ 下へ</button>
        </div>
      </div>
      <input className={`${inputClass} mt-4`} defaultValue={title} />
      <textarea className={`${inputClass} mt-3 min-h-28`} defaultValue={body} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700">＋画像</button>
        <button type="button" className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700">＋YouTube</button>
        <button type="button" className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700">＋PDF</button>
      </div>
    </div>
  );
}
