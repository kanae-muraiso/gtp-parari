// PARARI public product storefront for Japan.
import Link from "next/link";
import PackageStore from "@/components/parari/billing/PackageStore";

export const metadata = {
  title: "パッケージ | PARARI",
  description: "PARARI WRITERS A・Bと、開発予定のCLASS・BUSINESSパッケージをご案内します。",
};

export default function PackagesPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f3] text-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold tracking-[0.15em] text-neutral-900">PARARI</Link>
          <Link href="/login" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50">ログイン・登録</Link>
        </header>
        <div className="mt-12 mb-12 max-w-3xl">
          <p className="text-xs font-bold tracking-[0.18em] text-neutral-400">PACKAGES</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">あなたの活動に合ったPARARIを。</h1>
          <p className="mt-5 text-sm leading-8 text-neutral-600">
            まずは無料のWRITERS Aから作品づくりを始められます。
          </p>
        </div>
        <PackageStore />
        <footer className="mt-14 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
          <Link href="/" className="underline underline-offset-4">PARARIトップへ戻る</Link>
          <span className="mx-3">·</span>
          <Link href="/billing" className="underline underline-offset-4">契約内容を確認する</Link>
        </footer>
      </div>
    </main>
  );
}
