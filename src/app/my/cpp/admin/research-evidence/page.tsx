"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase } from "@/lib/supabaseClient";

type Member = {
  user_id: string;
  display_name: string;
  username: string | null;
  affiliation: string | null;
  visibility: "draft" | "published";
  created_at: string;
  research_evidence_updated_at: string | null;
};
type Queue = { total: number; members: Member[] };
const PAGE_SIZE = 50;
const dateLabel = (value: string) => new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

export default function CppDeferredResearchEvidencePage() {
  const [result, setResult] = useState<Queue | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const reset = () => { setResult(null); setPage(0); setRevision((n) => n + 1); };
    window.addEventListener("cpp-mode-changed", reset);
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") reset();
    });
    return () => {
      window.removeEventListener("cpp-mode-changed", reset);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setResult(null);
    const load = async () => {
      const response = await supabase?.rpc("cpp_admin_deferred_research_evidence", { p_search: query, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
      if (!active) return;
      setLoading(false);
      if (response?.error || !response?.data) {
        setError(response?.error?.code === "42501" ? "この一覧は管理者モード限定です。ログインし、右上の設定から管理者モードに切り替えてください。" : "一覧を取得できませんでした。再読み込みしてください。");
        return;
      }
      const next = response.data as Queue;
      if (page > 0 && !next.members.length) { setPage(0); return; }
      setResult(next);
    };
    void load();
    return () => { active = false; };
  }, [page, query, revision]);

  return <><CppSectionNav /><main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6"><div className="mx-auto max-w-5xl">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold text-red-600">管理者専用</p>
      <h1 className="mt-2 text-2xl font-black">研究歴の後日入力者</h1>
      <p className="mt-3 text-sm leading-7 text-neutral-600">研究歴がわかるページを「後で入力する」としている方の一覧です。本人が情報を入力して保存すると、この一覧から外れます。登録日の古い順に表示します。</p>
      <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(0); setRevision((n) => n + 1); }} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-xs font-bold text-neutral-600">氏名・ユーザー名・所属で検索<input type="search" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-normal" /></label>
        <button type="submit" disabled={loading} className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">検索</button>
        <button type="button" disabled={loading} onClick={() => setRevision((n) => n + 1)} className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold disabled:opacity-50">再読み込み</button>
      </form>
    </header>
    {loading ? <p role="status" className="mt-6 text-sm text-neutral-600">一覧を読み込んでいます…</p> : error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p> : result ? <>
      <p role="status" className="my-5 text-sm font-bold">{query ? "検索結果" : "後日入力"}：{result.total}人{result.total > 0 ? `（${page * PAGE_SIZE + 1}〜${page * PAGE_SIZE + result.members.length}人目）` : ""}</p>
      {!result.members.length ? <p className="rounded-2xl bg-white p-6 text-sm text-neutral-600">{query ? "条件に一致する方はいません。" : "現在、後日入力の方はいません。"}</p> : <ul className="divide-y divide-neutral-200 rounded-3xl bg-white px-6 shadow-sm">
        {result.members.map((member) => <li key={member.user_id} className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-bold text-neutral-950">{member.display_name}</h2>{member.username ? <p className="mt-1 break-all text-xs text-neutral-500">@{member.username}</p> : null}<p className="mt-2 text-sm text-neutral-600">{member.affiliation || "所属未記入"}</p></div>
            {member.visibility === "published" ? <Link href={`/cpp/researcher/${member.user_id}`} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-blue-700">プロフィールを見る</Link> : <span className="text-xs text-neutral-500">プロフィールは下書き</span>}
          </div>
          <p className="mt-3 text-xs leading-6 text-neutral-500">研究者登録：{dateLabel(member.created_at)} ／ 後日入力の更新：{member.research_evidence_updated_at ? dateLabel(member.research_evidence_updated_at) : "記録なし"}</p>
        </li>)}
      </ul>}
      {result.total > PAGE_SIZE ? <nav aria-label="一覧のページ" className="mt-5 flex items-center justify-center gap-4"><button type="button" disabled={page === 0} onClick={() => setPage((n) => n - 1)} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-bold disabled:opacity-40">前へ</button><span className="text-sm">{page + 1} / {Math.ceil(result.total / PAGE_SIZE)}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= result.total} onClick={() => setPage((n) => n + 1)} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-bold disabled:opacity-40">次へ</button></nav> : null}
    </> : null}
    <Link href="/my/cpp/home" className="mt-7 inline-block text-sm font-bold underline">CPPホームへ</Link>
  </div></main></>;
}
