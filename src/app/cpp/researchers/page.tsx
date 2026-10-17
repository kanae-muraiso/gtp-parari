import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "研究者として参加する | CPP",
  description: "博士課程学生・ポスドク・研究者の参加を受付中。研究を続けながら企業や異分野の研究者との接点を広げるCPP。登録無料。",
};

const topics = [
  {
    title: "CPPとは",
    paragraphs: [
      "CPP（Career Planning Program）は2005年に始まった、博士課程学生・ポスドク・研究者のためのキャリア形成プログラムです。既にある求人への応募だけを目的とするものではありません。",
      "研究者と企業が、専門分野や求人条件だけにとらわれず、まず互いを知ることを大切にしています。",
    ],
  },
  {
    title: "参加のメリット",
    paragraphs: [
      "研究室の外に接点を広げる：これまで接点のなかった企業や異分野の研究者を知り、将来の可能性を考えるきっかけをつくります。",
      "博士号取得前から参加できる：今すぐ就職先を決める必要はありません。早い段階から互いを知ることが、数年後の選択肢につながります。",
      "自分の価値を言葉にする：CPP WORKBOOKで研究経験や関心、これから取り組みたいことを少しずつ整理できます。作成中は下書き保存でき、公開時期も自分で決められます。",
      "自分で進路を選ぶ：求人に自分を合わせるだけではなく、自分が何をしたいか、どんな環境で力を発揮したいかを考え続けるための場所です。",
    ],
  },
  {
    title: "対象となる方",
    paragraphs: [
      "博士課程の大学院生、ポスドク、博士号を取得した研究者をはじめ、現在または過去に研究に携わった方が対象です。現在の所属先や就職・転職希望の有無だけで判断するものではありません。",
      "研究歴や成果は、ご自身のものを正確に記載してください。他人の氏名・業績を使った登録は認めません。",
    ],
  },
  {
    title: "登録の流れ",
    paragraphs: [
      "PARARIにログインし、氏名と登録時の確認事項を入力します。登録後はCPP WORKBOOKでプロフィールを少しずつ作成できます。公開する項目を確認し、自分のタイミングで公開できます。",
      "登録時には所属機関の公開プロフィールや代表論文のDOIなど、研究活動を確認できる情報を提出します。すぐに用意できない場合は後日提出を選べます。CPPは必要に応じて内容を確認します。",
    ],
  },
  {
    title: "よくある質問",
    paragraphs: [
      "Q. まだ博士課程の大学院生ですが、参加できますか？\nA. はい。博士号取得前から参加できます。\n\nQ. 今すぐ就職するつもりはありません。参加できますか？\nA. はい。CPPは求人への応募だけを目的とする場所ではありません。\n\nQ. 現在は研究職ではありません。参加できますか？\nA. 過去に研究に携わった方も対象として想定しています。現在の所属先がないことだけで対象外にはなりません。",
      "Q. プロフィールはすぐに公開されますか？\nA. いいえ。公開する時期は自分で決められます。公開した項目はCPP参加企業から閲覧できるため、公開前に確認してください。\n\nQ. メールアドレスは公開されますか？\nA. 連絡先として登録するメールアドレスは非公開情報として扱います。一方、公開プロフィールに自分で書いた内容は閲覧者に見えるため、連絡先を書き込まないよう確認してください。",
      "Q. 確認資料をすぐに用意できません。\nA. 後日提出を選んで登録できます。登録後の画面から提出してください。",
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
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">博士課程学生・研究者の皆さんへ</h1>
          <h2 className="mt-4 text-xl font-black sm:text-2xl">博士よ、人生を発明しよう。</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            研究してきたのは、まだ誰も知らないこと。これから発見するのは、まだ自分も知らない未来。
            CPPは研究を続けながら、企業や異分野の研究者との接点を広げるための場所です。今すぐ就職や転職を考える必要はありません。
          </p>
          <p className="mt-3 text-sm font-bold text-sky-800">参加無料 · 博士号取得前から参加できます</p>
          <Link href="/cpp/try" className="mt-4 inline-flex w-full justify-center rounded-lg bg-sky-700 px-5 py-3.5 font-bold text-white hover:bg-sky-800 sm:w-auto">研究者登録へ進む（無料）</Link>
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
            研究歴の確認には所属機関の公開プロフィールや代表論文のDOIなどを利用できます。すぐに用意できない場合は後日提出も選べます。交流機能は順次提供予定です。
          </p>
          <Link
            href="/cpp/try"
            className="mt-5 inline-flex w-full justify-center rounded-lg bg-sky-700 px-5 py-3.5 font-bold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:w-auto"
          >
            研究者として参加する（無料）
          </Link>
        </section>
      </div>
    </main>
  );
}
