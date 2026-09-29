import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPP | Career Planning Program",
  description: "博士・研究者と企業、社会をつなぐCPPの入口です。",
};

const navigation = [
  { label: "CPPについて", href: "https://cppweb.jp/", external: true },
  { label: "研究者の方", href: "/cpp/try" },
  { label: "企業の方", href: "/cpp/company/try" },
  { label: "CPP Alumni（同窓生の方）", href: "/cpp/alumni" },
  { label: "イベント・お知らせ", href: "https://cppweb.jp/", external: true },
] as const;

export default function CppEntryPage() {
  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 text-[#12315b] sm:py-14">
      <div className="mx-auto max-w-md rounded-[1.75rem] border border-sky-200 bg-white p-5 shadow-sm sm:p-8">
        <header>
          <h1 className="text-4xl font-black tracking-tight">CPP</h1>
          <p className="mt-0.5 text-lg font-medium">Career Planning Program</p>
        </header>

        <div className="relative mt-5 h-32 overflow-hidden rounded-xl">
          <Image
            src="/cpp-landscape.webp"
            alt="静かな湖面と、その向こうに連なる山並み"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
          />
        </div>

        <p className="my-6 text-center text-lg font-bold leading-relaxed">
          博士・研究者と企業、<br />社会をつなぐ。
        </p>

        <nav aria-label="CPPのご案内" className="space-y-2">
          {navigation.map(({ label, href }) =>
            href.startsWith("http") ? (
              <a key={label} href={href} className="block rounded-lg border border-sky-300 px-4 py-2.5 font-bold transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                {label}
              </a>
            ) : (
              <Link key={label} href={href} className="block rounded-lg border border-sky-300 px-4 py-2.5 font-bold transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                {label}
              </Link>
            ),
          )}
        </nav>

        <details className="group mt-4 rounded-lg border border-sky-300">
          <summary className="cursor-pointer list-none px-4 py-2.5 font-bold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
            登録の注意事項 <span aria-hidden="true" className="float-right group-open:rotate-180">⌄</span>
          </summary>
          <div className="border-t border-sky-200 px-4 py-4 text-sm leading-7 text-slate-700">
            <ul className="list-disc space-y-2 pl-5">
              <li>登録・編集にはPARARIアカウントを使用します。</li>
              <li>企業・団体の登録にはCPPが発行する招待コードが必要です。</li>
              <li>研究者登録のORCID確認は準備中です。現在の登録画面ではORCIDによる本人確認は行われません。</li>
            </ul>
          </div>
        </details>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/my/cpp/home" className="underline underline-offset-4 hover:text-[#12315b]">登録済みの方はこちら</Link>
        </p>
      </div>
    </main>
  );
}
