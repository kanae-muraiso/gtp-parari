"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCppSave } from "./CppSaveBoundary";

type Evidence = { research_evidence: string | null; research_evidence_deferred: boolean; research_evidence_updated_at: string | null };

export default function CppResearchEvidenceEditor({ userId }: { userId: string }) {
  const { queueSave } = useCppSave();
  const [saved, setSaved] = useState<Evidence | null>(null);
  const [evidence, setEvidence] = useState("");
  const [deferred, setDeferred] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const value = deferred ? null : evidence.trim() || null;
  const savedValue = saved?.research_evidence_deferred ? null : saved?.research_evidence?.trim() || null;

  useEffect(() => {
    let active = true;
    setSaved(null);
    setError("");
    const load = async () => {
      const result = await supabase?.from("cpp_profiles")
        .select("research_evidence, research_evidence_deferred, research_evidence_updated_at")
        .eq("user_id", userId).single<Evidence>();
      if (!active) return;
      if (result?.error || !result?.data) {
        setError("研究歴の情報を読み込めませんでした。再読み込みしてください。");
        return;
      }
      setEvidence(result.data.research_evidence ?? "");
      setDeferred(result.data.research_evidence_deferred);
      setSaved(result.data);
    };
    void load();
    return () => { active = false; };
  }, [userId, retry]);

  useEffect(() => {
    if (!supabase || !saved || (value === savedValue && deferred === saved.research_evidence_deferred)) return;
    const client = supabase;
    return queueSave(async () => {
      setError("");
      if (!deferred && !value) {
        const message = "研究歴がわかるページを入力するか、「後で入力する」を選んでください。";
        setError(message);
        throw new Error(message);
      }
      const result = await client.from("cpp_profiles").update({
        research_evidence: value,
        research_evidence_deferred: deferred,
        research_evidence_updated_at: new Date().toISOString(),
      }).eq("user_id", userId)
        .select("research_evidence, research_evidence_deferred, research_evidence_updated_at").single<Evidence>();
      if (result.error || !result.data) {
        const message = `研究歴の情報を保存できませんでした: ${result.error?.message ?? "再度お試しください。"}`;
        setError(message);
        throw new Error(message);
      }
      setSaved(result.data);
      setEvidence(result.data.research_evidence ?? "");
    });
  }, [deferred, queueSave, saved, savedValue, userId, value]);

  const dirty = saved && (value !== savedValue || deferred !== saved.research_evidence_deferred);
  return <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold text-neutral-950">研究歴がわかるページ</h2>
      {saved ? <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${saved.research_evidence_deferred ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{saved.research_evidence_deferred ? "保存済み：後日入力" : "保存済み：入力済み"}</span> : null}
    </div>
    <p className="mt-3 text-sm leading-7 text-neutral-600">大学・研究機関の紹介ページ、researchmap、論文の掲載ページなど、ご自身の研究歴がわかるものを1つ教えてください。登録時の情報をここでも確認・修正できます。現在、研究機関に所属していなくても大丈夫です。</p>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {!saved ? error ? <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-3 text-sm font-bold text-blue-700 underline">再読み込み</button> : <p className="mt-4 text-sm text-neutral-500">読み込んでいます…</p> : <>
      <label className="mt-4 block text-sm font-semibold">ページのURL、または論文のDOI
        <textarea value={evidence} onChange={(event) => { setEvidence(event.target.value); setError(""); }} disabled={deferred} maxLength={2000} rows={3} placeholder="https://... または 10...." className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 font-normal disabled:bg-neutral-100" />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={deferred} onChange={(event) => { setDeferred(event.target.checked); setError(""); }} />今は用意できないので、後で入力する</label>
      {deferred ? <p className="mt-2 text-xs leading-6 text-amber-800">後で入力する方には、CPPから確認のご連絡をする場合があります。</p> : null}
      <p className="mt-4 text-xs leading-6 text-neutral-500">{dirty ? "変更はまだ保存されていません。" : ""}ページを移動するとき、またはページ上部の「今すぐ保存」で保存します。</p>
    </>}
  </section>;
}
