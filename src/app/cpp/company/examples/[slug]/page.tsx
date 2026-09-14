"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import CppCompanyPublicRenderer from "@/components/parari/cpp/company/CppCompanyPublicRenderer";
import { companyExampleToPublicModel } from "@/lib/cpp/companyExampleAdapter";
import { getCompanyExample } from "@/lib/cpp/companyExamples";
import { getCppCompanyTemplate, templateTypeFromExampleSlug } from "@/lib/cpp/companyPageTemplates";

export default function CppCompanyExampleDetailPage() {
  const params = useParams<{ slug: string }>();
  const example = getCompanyExample(params.slug);

  if (!example) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-neutral-950">完成見本が見つかりません</h1>
          <Link href="/cpp/company/examples" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">一覧へ戻る</Link>
        </div>
      </main>
    );
  }

  const type = templateTypeFromExampleSlug(example.slug);
  const template = getCppCompanyTemplate(type);
  const model = companyExampleToPublicModel(example);

  const banner = (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">CPP COMPANY 完成見本 · 架空企業</div>
          <h2 className="mt-2 text-lg font-bold text-neutral-950">{template.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-600">{template.description}</p>
          <p className="mt-2 text-xs leading-6 text-neutral-400">向いている会社：{template.recommendedFor}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cpp/company/examples" className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700">← 5つの見本</Link>
          <Link href={`/my/cpp/company/layout?template=${type}`} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">このひな形を使う →</Link>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-500">
        この見本は、実際のCOMPANY WORKBOOKと同じ「会社紹介／研究・技術／ポジション／募集／資料」と、同じページ構成・表示スタイルから描画しています。見本専用の秘密のレイアウトではありません。
      </div>
    </div>
  );

  return <CppCompanyPublicRenderer model={model} banner={banner} footerLabel="CPP COMPANY EXAMPLE · FICTIONAL COMPANY" />;
}
