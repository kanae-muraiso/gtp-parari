import Link from "next/link";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import CppCompanyWorkbook from "@/components/parari/cpp/company/CppCompanyWorkbook";
import CppCompanySupportModeBanner from "@/components/parari/cpp/company/CppCompanySupportModeBanner";

export default function CppCompanyEditorPage() {
  return (
    <>
      <CppSectionNav />
      <CppCompanySupportModeBanner />
      <CppCompanyWorkbook />
      <div className="fixed bottom-5 right-5 z-50 flex flex-wrap justify-end gap-2">
        <Link
          href="/my/cpp/social-profile"
          className="rounded-full border border-neutral-300 bg-white px-4 py-3 text-xs font-bold text-neutral-700 shadow-lg"
        >
          SOCIAL PROFILE
        </Link>
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
