import Link from "next/link";
import CppCompanyWorkbook from "@/components/parari/cpp/company/CppCompanyWorkbook";

export default function CppCompanyEditorPage() {
  return (
    <>
      <CppCompanyWorkbook />
      <div className="fixed bottom-5 right-5 z-50 flex flex-wrap justify-end gap-2">
        <Link
          href="/my/cpp/company/support"
          className="rounded-full border border-neutral-300 bg-white px-4 py-3 text-xs font-bold text-neutral-700 shadow-lg"
        >
          コンサルタント
        </Link>
        <Link
          href="/my/cpp/company/layout"
          className="rounded-full border border-neutral-700 bg-white px-4 py-3 text-xs font-bold text-neutral-900 shadow-lg"
        >
          ページ構成
        </Link>
        <Link
          href="/my/cpp/company/preview"
          className="rounded-full bg-neutral-900 px-5 py-3 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5"
        >
          プレビュー →
        </Link>
      </div>
    </>
  );
}
