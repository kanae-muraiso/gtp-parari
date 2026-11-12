"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Disclosure = {
  seller_type: "individual" | "company";
  legal_name: string; representative_name: string; postal_code: string;
  address: string; phone: string; contact_email: string;
  delivery_terms: string; return_terms: string; payment_terms: string;
  privacy_policy: string; updated_at: string;
};
const sections: { key: keyof Disclosure; label: string }[] = [
  { key: "legal_name", label: "販売事業者" },
  { key: "representative_name", label: "代表者・責任者" },
  { key: "postal_code", label: "郵便番号" },
  { key: "address", label: "所在地" },
  { key: "phone", label: "電話番号" },
  { key: "contact_email", label: "連絡先メール" },
  { key: "payment_terms", label: "支払方法・支払時期" },
  { key: "delivery_terms", label: "商品・サービスの提供時期と方法" },
  { key: "return_terms", label: "キャンセル・返品・返金条件" },
  { key: "privacy_policy", label: "個人情報の取扱い" },
];
function SellerInfo() {
  const params = useSearchParams();
  const productId = params.get("productId");
  const applicationId = params.get("applicationId");
  const [data, setData] = React.useState<Disclosure | null>(null);
  const [message, setMessage] = React.useState("読み込んでいます…");
  React.useEffect(() => {
    let active = true;
    const request = productId ? "productId=" + encodeURIComponent(productId)
      : applicationId ? "applicationId=" + encodeURIComponent(applicationId) : "";
    if (!request) { setMessage("対象の販売が指定されていません。"); return; }
    fetch("/api/seller/disclosure/public?" + request, { cache: "no-store" })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json?.ok || !json?.disclosure) throw new Error(json?.message || "表示できません。");
        if (active) { setData(json.disclosure); setMessage(""); }
      }).catch(cause => { if (active) setMessage(cause instanceof Error ? cause.message : "取得できませんでした。"); });
    return () => { active = false; };
  }, [productId, applicationId]);
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold">特定商取引法に基づく表記・個人情報の取扱い</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">以下は販売者・主催者が登録した情報です。PARARIは販売者に代わって販売条件を保証するものではありません。</p>
        {message && <p className="mt-6 text-sm" role="status">{message}</p>}
        {data && (
          <>
            <dl className="mt-6 divide-y divide-neutral-100">
              {sections.filter(x => x.key !== "representative_name" || data.seller_type === "company").map(section => (
                <div key={section.key} className="py-4">
                  <dt className="text-xs font-bold text-neutral-500">{section.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">{data[section.key]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-neutral-500">最終更新：{new Date(data.updated_at).toLocaleDateString("ja-JP")}</p>
          </>
        )}
        <Link href={productId ? "/buy/" + encodeURIComponent(productId) : "/my/works"}
          className="mt-6 inline-block text-sm font-semibold text-sky-800 underline">戻る</Link>
      </div>
    </main>
  );
}
export default function SellerInfoPage() {
  return <React.Suspense fallback={<p className="p-6">読み込んでいます…</p>}><SellerInfo /></React.Suspense>;
}
