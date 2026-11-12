"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const formFields = [
  { key: "legal_name", label: "販売者の氏名・法人名", placeholder: "個人は戸籍上の氏名、法人は登記上の名称" },
  { key: "representative_name", label: "法人の代表者・責任者", placeholder: "法人の場合は必須" },
  { key: "postal_code", label: "郵便番号", placeholder: "例：600-0000" },
  { key: "address", label: "所在地", placeholder: "都道府県から建物・部屋番号まで" },
  { key: "phone", label: "電話番号", placeholder: "購入者から連絡できる番号" },
  { key: "contact_email", label: "お問い合わせメール", placeholder: "例：seller@example.com" },
  { key: "payment_terms", label: "支払方法と支払時期", placeholder: "Squareカード決済、購入時に支払い確定など", multiline: true },
  { key: "delivery_terms", label: "作品の提供時期・提供方法", placeholder: "決済完了後、購入者の書棚から閲覧可能、など", multiline: true },
  { key: "return_terms", label: "キャンセル・返品・返金条件", placeholder: "購入前に分かるよう具体的に記載", multiline: true },
  { key: "privacy_policy", label: "個人情報の取扱い", placeholder: "取得する情報、利用目的、管理、第三者提供、問い合わせ先など", multiline: true },
] as const;
type FieldKey = typeof formFields[number]["key"];
type SellerForm = Record<FieldKey, string> & { seller_type: "individual" | "company" };
const empty: SellerForm = {
  seller_type: "individual", legal_name: "", representative_name: "",
  postal_code: "", address: "", phone: "", contact_email: "", payment_terms: "",
  delivery_terms: "", return_terms: "", privacy_policy: "",
};

export default function SellerDisclosureSettingsPage() {
  const [form, setForm] = React.useState<SellerForm>(empty);
  const [published, setPublished] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("ログインしてから設定してください。");
        const res = await fetch("/api/seller/disclosure", { headers: {
          Authorization: "Bearer " + session.access_token,
        }, cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.message || "読み込みに失敗しました。");
        if (mounted && json.disclosure) {
          const next = { ...empty };
          for (const f of formFields) next[f.key] = String(json.disclosure[f.key] || "");
          next.seller_type = json.disclosure.seller_type === "company" ? "company" : "individual";
          setForm(next);
          setPublished(json.disclosure.published === true);
        }
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "読み込みに失敗しました。");
      } finally { if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function save(publish: boolean) {
    setMessage(""); setError(""); setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログインが必要です。");
      const res = await fetch("/api/seller/disclosure", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ ...form, published: publish, confirmedSellerResponsibility: confirmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message || "保存できませんでした。");
      setPublished(publish);
      setMessage(publish
        ? "販売者情報を公開しました。購入者は販売ページから確認できます。"
        : "下書きを保存しました。購入者にはまだ公開されません。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-2xl">
        <Link href="/my/settings#sell-work" className="text-sm font-semibold text-sky-800 underline">販売の設定へ戻る</Link>
        <section className="mt-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold">販売者情報・個人情報の取扱い</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            有料販売の前に登録する共通設定です。Squareの本人確認とは別の、
            購入者に公開する販売者情報です。ご自身が販売者として責任を負う内容を記入してください。
          </p>
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>公開される情報にご注意ください。</strong>
            氏名・住所・電話番号を含む入力内容は、公開すると誰でも閲覧できます。
            このフォームには請求時のみ開示する方式は実装されていません。
          </div>
          {loading ? <p className="mt-6" role="status">読み込んでいます…</p> : (
            <div className="mt-6 space-y-5">
              <label className="block text-sm font-semibold">
                販売者の区分
                <select className="mt-2 w-full rounded-xl border p-3" value={form.seller_type}
                  onChange={e => setForm(old => ({ ...old, seller_type: e.target.value === "company" ? "company" : "individual" }))}>
                  <option value="individual">個人</option>
                  <option value="company">法人</option>
                </select>
              </label>
              {formFields.filter(f => form.seller_type === "company" || f.key !== "representative_name").map(field => (
                <label key={field.key} className="block text-sm font-semibold">
                  {field.label}
                  {"multiline" in field ? (
                    <textarea className="mt-2 w-full rounded-xl border border-neutral-300 p-3 font-normal" rows={field.key === "privacy_policy" ? 8 : 4}
                      placeholder={field.placeholder} value={form[field.key]}
                      onChange={e => setForm(old => ({ ...old, [field.key]: e.target.value }))} />
                  ) : (
                    <input className="mt-2 w-full rounded-xl border border-neutral-300 p-3 font-normal"
                      placeholder={field.placeholder} value={form[field.key]}
                      onChange={e => setForm(old => ({ ...old, [field.key]: e.target.value }))} />
                  )}
                </label>
              ))}
              <label className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4 text-sm leading-6">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                <span>私は表示される販売者本人または正当な権限を持つ担当者です。
                  作品・サービスの提供、キャンセル・返金、問い合わせ対応について販売者として責任を負い、
                  上記の情報が購入者に公開されることを確認しました。</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => void save(false)}
                  className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold disabled:opacity-50">下書き保存</button>
                <button type="button" disabled={saving || !confirmed} onClick={() => void save(true)}
                  className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                  {saving ? "保存中…" : published ? "公開情報を更新" : "確認して公開"}
                </button>
              </div>
              <p className="text-xs text-neutral-500">この設定は販売者共通です。商品の価格やイベント固有の条件は個別の販売・受付設定にも表示してください。</p>
              {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
              {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
