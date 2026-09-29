import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "研究者として参加する | CPP",
  description: "CPPへの研究者参加について、対象者、登録の流れ、公開範囲をご案内します。",
};

const topics = [
  {
    title: "CPPとは",
    paragraphs: [
      "CPPは、博士・研究者の知識や経験から、企業や社会との新しい接点をつくる活動です。既にある求人への応募だけを目的とするものではありません。",
      "研究の内容だけでなく、これから何に取り組みたいかも、自分の言葉で伝えられる場所を目指しています。",
    ],
  },
  {
    title: "参加のメリット",
    paragraphs: [
      "CPP WORKBOOKに研究内容、経歴、成果を少しずつ記録し、企業に伝えるためのプロフィールを作れます。作成中は下書きとして保存できます。",
      "プロフィールを公開するタイミングは自分で決められます。公開した項目は一般の閲覧者から見えるため、公開前に内容を確認してください。",
    ],
  },
  {
    title: "対象となる方",
    paragraphs: [
      "博士号を取得した方、取得を目指している方を中心に、現在または過去に研究に携わった方を想定しています。現在の大学・研究機関への所属だけで判断するものではありません。",
      "研究歴や成果は、ご自身のものを正確に記載してください。他人の氏名・業績を使った登録は認めません。",
    ],
  },
  {
    title: "登録の流れ",
    paragraphs: [
      "PARARIにログインし、氏名と登録時の確認事項を入力します。登録後はCPP WORKBOOKでプロフィールを作成し、公開する項目を確認してから公開できます。",
      "登録時にはPARARIアカウントに加えてORCIDで認証します。ORCID iDを入力するだけでなく、ORCIDの画面でログインし、CPPとの接続を許可していただきます。研究歴や業績は別途プロフィールで確認します。",
    ],
  },
  {
    title: "よくある質問",
    paragraphs: [
      "Q. 現在は研究職ではありません。参加できますか？\nA. 過去に研究に携わった方も対象として想定しています。現在の所属先がないことだけで対象外にはなりません。",
      "Q. メールアドレスは公開されますか？\nA. 連絡先として登録するメールアドレスは非公開情報として扱います。一方、公開プロフィールに自分で書いた内容は閲覧者に見えるため、連絡先を書き込まないよう確認してください。",
      "Q. ORCIDは必須ですか？\nA. 研究者登録ではORCID認証を標準とします。ORCIDを利用できない場合の確認方法は、CPPから別途ご案内します。",
    ],
  },
] as const;

export default function CppResearchersPage() {
  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 text-[#12315b] sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Link href="/cpp" className="text-sm font-bold text-sky-800 hover:underline">
          ← CPPの入口へ
        </Link>

        <header className="mt-5 rounded-2xl border border-sky-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-bold tracking-widest text-sky-700">CPP · RESEARCHERS</div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">研究者として参加する</h1>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            CPPへの参加について、登録前に知っていただきたいことをまとめました。
            気になる項目を開いてご覧ください。
          </p>
        </header>

        <section aria-label="研究者参加のご案内" className="mt-5 space-y-2">
          {topics.map(({ title, paragraphs }) => (
            <details key={title} className="group rounded-xl border border-sky-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-bold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                <span>{title}</span>
                <span aria-hidden="true" className="text-xl leading-none text-sky-700 group-open:rotate-45">＋</span>
              </summary>
              <div className="space-y-3 border-t border-sky-100 px-5 py-4 text-sm leading-7 whitespace-pre-line text-slate-700">
                {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </details>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-sm leading-7 text-slate-700">
            なりすましを抑えるため、研究者登録ではPARARIアカウントに加えてORCIDで認証します。ORCIDアカウントの操作を確認したうえで、研究歴や業績も確認します。
          </p>
          <Link
            href="/cpp/try"
            className="mt-5 inline-flex w-full justify-center rounded-lg bg-sky-700 px-5 py-3.5 font-bold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:w-auto"
          >
            研究者として参加する（登録へ進む）
          </Link>
        </section>
      </div>
    </main>
  );
}
