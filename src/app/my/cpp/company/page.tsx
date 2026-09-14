import Link from "next/link";
import CppCompanyWorkbook from "@/components/parari/cpp/company/CppCompanyWorkbook";

export default function CppCompanyEditorPage() {
  return (
    <>
      <CppCompanyWorkbook />
      <Link
        href="/my/cpp/company/layout"
        className="fixed bottom-5 right-5 z-50 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
      >
        ページ構成 →
      </Link>
    </>
  );
}
