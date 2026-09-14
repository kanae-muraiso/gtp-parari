import Link from "next/link";

export default function CppEntryPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="text-xs font-black tracking-[0.2em] text-neutral-400">CPP · CAREER PLANNING PROGRAM</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-neutral-950 sm:text-5xl">CPPに参加する</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-600 sm:text-base">
            CPPは、博士号取得者・取得予定者を中心とした研究者と、研究者を必要とする企業・団体が出会うための場です。
            研究者と企業では登録方法が異なります。
          </p>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="flex min-h-[360px] flex-col rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">FOR RESEARCHERS</div>
            <h2 className="mt-4 text-2xl font-black text-neutral-950 sm:text-3xl">研究者の方</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              研究内容、専門分野、経歴、研究成果などをCPP WORKBOOKに蓄積し、企業に向けた研究者プロフィールを作成できます。
              登録後も少しずつ書き足していけます。
            </p>
            <div className="mt-6 space-y-2 text-sm text-neutral-700">
              <div>・博士号取得者・取得予定者を中心とした研究者向け</div>
              <div>・登録後、CPP WORKBOOKを利用</div>
              <div>・公開前でも保存しながら作成可能</div>
            </div>
            <div className="mt-auto pt-8">
              <Link href="/cpp/try" className="inline-flex rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
                研究者として登録する →
              </Link>
            </div>
          </section>

          <section className="flex min-h-[360px] flex-col rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">FOR COMPANIES</div>
            <h2 className="mt-4 text-2xl font-black text-neutral-950 sm:text-3xl">企業・団体の方</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              会社情報、研究・技術、求める研究者像、募集情報をCPP COMPANY WORKBOOKで作成し、博士・研究者へ伝えることができます。
            </p>
            <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-950">
              <div className="font-bold">企業・団体の登録にはCPP発行の招待コードが必要です。</div>
              <div className="mt-1 text-amber-800">招待コードをお持ちの担当者のみ登録できます。</div>
            </div>
            <div className="mt-auto pt-8">
              <Link href="/cpp/company/try" className="inline-flex rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
                企業・団体として登録する →
              </Link>
            </div>
          </section>
        </div>

        <p className="mt-7 text-center text-xs leading-6 text-neutral-400">
          CPPの登録・編集機能にはPARARIのアカウントを使用します。
        </p>
      </div>
    </main>
  );
}
