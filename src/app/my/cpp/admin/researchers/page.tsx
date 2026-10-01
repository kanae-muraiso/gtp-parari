"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase } from "@/lib/supabaseClient";

type Researcher = {
  user_id: string;
  display_name: string;
  username: string | null;
  affiliation: string | null;
  created_at: string;
  updated_at: string;
  visibility: "draft" | "published";
  missing_fields: string[];
  alumni_only: boolean;
  research_evidence_status: "deferred" | "provided" | "missing";
  has_photo: boolean;
  research_field_count: number;
  keyword_count: number;
  history_count: number;
  summary_count: number;
  summary_in_progress_count: number;
  publication_count: number;
  has_self_appeal: boolean;
};
type Result = { total: number; members: Researcher[] };
const PAGE_SIZE = 50;
const dateLabel = (value: string) => new Date(value).toLocaleString("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const countLabel = (count: number) => count ? `${count}件` : "未入力";

export default function CppAdminResearchersPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const reset = () => { setResult(null); setLoading(true); setPage(0); setRevision((n) => n + 1); };
    window.addEventListener("cpp-mode-changed", reset);
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") reset();
    });
    return () => { window.removeEventListener("cpp-mode-changed", reset); subscription?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setResult(null);
    const load = async () => {
      try {
        const response = await supabase?.rpc("cpp_admin_researchers", { p_search: query, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
        if (!active) return;
        if (response?.error || !response?.data) {
          setError(response?.error?.code === "42501" ? "この一覧は管理者モード限定です。ログインし、右上の設定から管理者モードに切り替えてください。" : "研究者一覧を取得できませんでした。再読み込みしてください。");
          return;
        }
        const next = response.data as Result;
        if (page > 0 && !next.members.length) { setPage(0); return; }
        setResult(next);
      } catch {
        if (active) setError("研究者一覧を取得できませんでした。再読み込みしてください。");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [page, query, revision]);

  return <><CppSectionNav /><main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold text-red-600">管理者専用</p>
      <h1 className="mt-2 text-2xl font-black">研究者一覧・プロフィール作成状況</h1>
      <p className="mt-3 text-sm leading-7 text-neutral-600">研究者登録を開始した日時の古い順に表示します。下書きの方も含みます。必須項目の入力完了と、プロフィールの公開は別の状態です。</p>
      <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(0); setRevision((n) => n + 1); }} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-xs font-bold text-neutral-600">氏名・ユーザー名・所属で検索<input type="search" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-normal" /></label>
        <button type="submit" disabled={loading} className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">検索</button>
        <button type="button" disabled={loading} onClick={() => setRevision((n) => n + 1)} className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold disabled:opacity-50">再読み込み</button>
      </form>
    </header>
    {loading ? <p role="status" className="mt-6 text-sm text-neutral-600">研究者一覧を読み込んでいます…</p> : error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p> : result ? <>
      <p role="status" className="my-5 text-sm font-bold">{query ? "検索結果" : "登録研究者"}：{result.total}人{result.total ? `（${page * PAGE_SIZE + 1}〜${page * PAGE_SIZE + result.members.length}人目）` : ""}</p>
      {!result.members.length ? <p className="rounded-2xl bg-white p-6 text-sm text-neutral-600">{query ? "条件に一致する方はいません。" : "まだ研究者登録はありません。"}</p> : <ol start={page * PAGE_SIZE + 1} className="space-y-4">
        {result.members.map((member, index) => <li key={member.user_id} className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-neutral-500">{page * PAGE_SIZE + index + 1} ／ 登録 {dateLabel(member.created_at)}</p>
              <h2 className="mt-2 text-lg font-bold text-neutral-950">{member.display_name}</h2>
              {member.username ? <p className="mt-1 break-all text-xs text-neutral-500">@{member.username}</p> : null}
              <p className="mt-2 text-sm text-neutral-600">{member.affiliation || "所属未記入"}</p>
              {member.alumni_only ? <p className="mt-2 text-xs font-bold text-amber-700">現在は同窓会のみで参加</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-2 text-xs font-bold ${member.missing_fields.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{member.missing_fields.length ? `必須項目：残り${member.missing_fields.length}項目` : "必須項目：入力完了"}</span>
              <span className={`rounded-full px-3 py-2 text-xs font-bold ${member.visibility === "published" ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-600"}`}>{member.visibility === "published" ? "公開中" : "下書き・未公開"}</span>
            </div>
          </div>
          {member.missing_fields.length ? <details className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><summary className="cursor-pointer font-bold">未入力の必須項目を見る</summary><p className="mt-2 leading-7">{member.missing_fields.join("、")}</p></details> : null}
          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Progress label="顔写真" value={member.has_photo ? "登録済み" : "未登録"} />
            <Progress label="研究分野" value={countLabel(member.research_field_count)} />
            <Progress label="キーワード" value={countLabel(member.keyword_count)} />
            <Progress label="学歴・職歴" value={countLabel(member.history_count)} />
            <Progress label="研究概要" value={member.summary_count ? `${member.summary_count}件（作成中 ${member.summary_in_progress_count}件）` : "未作成"} />
            <Progress label="論文・発表" value={countLabel(member.publication_count)} />
            <Progress label="自己アピール" value={member.has_self_appeal ? "入力あり" : "未入力"} />
            <Progress label="研究歴の確認情報" value={member.research_evidence_status === "provided" ? "入力済み" : member.research_evidence_status === "deferred" ? "後で入力する" : "未入力"} />
          </dl>
          {member.visibility === "published" ? <Link href={`/cpp/researcher/${member.user_id}`} className="mt-5 inline-block rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-blue-700">公開プロフィールを見る</Link> : null}
        </li>)}
      </ol>}
      {result.total > PAGE_SIZE ? <nav aria-label="研究者一覧のページ" className="mt-5 flex items-center justify-center gap-4"><button type="button" disabled={page === 0} onClick={() => setPage((n) => n - 1)} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-bold disabled:opacity-40">前へ</button><span className="text-sm">{page + 1} / {Math.ceil(result.total / PAGE_SIZE)}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= result.total} onClick={() => setPage((n) => n + 1)} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-bold disabled:opacity-40">次へ</button></nav> : null}
    </> : null}
    <Link href="/my/cpp/home" className="mt-7 inline-block text-sm font-bold underline">CPPホームへ</Link>
  </div></main></>;
}

function Progress({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-neutral-500">{label}</dt><dd className="mt-1 font-semibold text-neutral-800">{value}</dd></div>;
}
