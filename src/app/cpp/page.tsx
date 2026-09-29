import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPP | 博士・研究者と企業が出会う場所",
  description:
    "CPP（Career Planning Program）は、博士・研究者の力から新しい仕事と未来を生み出すための活動です。研究者、企業、同窓生の入口をご案内します。",
};

export default function CppEntryPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 text-neutral-950 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="text-xs font-black tracking-[0.2em] text-pink-700">
            CPP · CAREER PLANNING PROGRAM
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            博士・研究者の力から、
            <br />
            新しい仕事をつくる。
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-8 text-neutral-700 sm:text-base">
            CPPは、博士・研究者と企業が出会い、まだ求人になっていない可能性も一緒に探る活動です。
            ここはPARARI内にあるCPPの入口です。初めての方は、下の案内からお進みください。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="https://cppweb.jp/"
              className="inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              CPPについて詳しく知る →
            </a>
            <Link
              href="/my/cpp/home"
              className="inline-flex rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold transition hover:border-neutral-500"
            >
              登録済みの方はこちら →
            </Link>
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="flex flex-col rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-black tracking-[0.18em] text-pink-700">RESEARCHERS</div>
            <h2 className="mt-3 text-2xl font-black">博士・研究者の方</h2>
            <p className="mt-4 flex-1 text-sm leading-7 text-neutral-600">
              自分の研究、経歴、これから取り組みたいことをCPP WORKBOOKにまとめられます。
              登録後も少しずつ書き足せます。
            </p>
            <Link
              href="/cpp/try"
              className="mt-7 inline-flex self-start rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold transition hover:border-neutral-500"
            >
              現在の研究者登録へ →
            </Link>
          </section>

          <section className="flex flex-col rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-black tracking-[0.18em] text-pink-700">COMPANIES</div>
            <h2 className="mt-3 text-2xl font-black">企業・団体の方</h2>
            <p className="mt-4 flex-1 text-sm leading-7 text-neutral-600">
              研究者との出会いから、事業や技術の新しい可能性を考えるための入口です。
              企業・団体登録にはCPPが発行する招待コードが必要です。
            </p>
            <Link
              href="/cpp/company/try"
              className="mt-7 inline-flex self-start rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold transition hover:border-neutral-500"
            >
              招待コードをお持ちの方 →
            </Link>
          </section>
        </div>

        <section className="flex flex-col gap-5 rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-pink-700">CPP ALUMNI</div>
            <h2 className="mt-2 text-xl font-black">過去にCPPへ参加された方</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              CPP同窓会で、当時の参加歴や現在の活動を共有できます。
            </p>
          </div>
          <Link
            href="/cpp/alumni"
            className="inline-flex shrink-0 self-start rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold transition hover:border-neutral-500"
          >
            CPP同窓会へ →
          </Link>
        </section>

        <p className="px-2 text-center text-xs leading-6 text-neutral-500">
          CPPの登録・編集にはPARARIアカウントを使用します。研究者登録時のORCID確認は現在準備中です。
        </p>
      </div>
    </main>
  );
}
