"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppSectionNav from "./CppSectionNav";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  is_important: boolean;
  created_at: string;
  published_at: string | null;
};
type Result = { items: Announcement[]; total: number; can_manage: boolean };
const PAGE_SIZE = 20;
const panel = "rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm";
const button = "inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";
const primary = "rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50";
const input = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base font-normal";
const dateLabel = (value: string) => new Date(value).toLocaleString("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

// Remount on identity/participation changes so drafts never survive a mode switch.
export default function CppResearcherAnnouncements({ manage = false }: { manage?: boolean }) {
  const [revision, setRevision] = useState(0);
  const identity = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const reset = () => setRevision(n => n + 1);
    window.addEventListener("cpp-mode-changed", reset);
    window.addEventListener("cpp-participation-changed", reset);
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (identity.current !== undefined && identity.current !== userId) reset();
      identity.current = userId;
    });
    return () => {
      window.removeEventListener("cpp-mode-changed", reset);
      window.removeEventListener("cpp-participation-changed", reset);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  return <NewsContent key={`${manage}-${revision}`} manage={manage} />;
}

function NewsContent({ manage }: { manage: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const editor = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Announcement["status"]>("draft");
  const [important, setImportant] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(""); setResult(null);
    const load = async () => {
      try {
        if (!supabase) throw new Error("接続設定を確認できませんでした。");
        const { data, error } = await supabase.rpc("cpp_researcher_news", { p_manage: manage, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
        if (!active) return;
        if (error) {
          setLoadError(error.code === "42501"
            ? manage ? "このページは管理者モード限定です。ログインし、設定から管理者モードに切り替えてください。" : "研究者として登録したアカウントでログインしてください。モードを切り替えられる方は、研究者モードで確認できます。"
            : "お知らせを取得できませんでした。再読み込みしてください。");
          return;
        }
        if (!data) throw new Error("お知らせを取得できませんでした。");
        const next = data as Result;
        if (page > 0 && !next.items.length) { setPage(0); return; }
        setResult(next);
      } catch {
        if (active) setLoadError("お知らせを取得できませんでした。再読み込みしてください。");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [manage, page, refresh]);

  const edit = (item: Announcement | null) => {
    setEditing(item); setTitle(item?.title ?? ""); setBody(item?.body ?? "");
    setStatus(item?.status ?? "draft"); setImportant(item?.is_important ?? false);
    setSaveError(""); setNotice("");
    editor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const save = async (item?: Announcement) => {
    if (!supabase || saving.current) return;
    saving.current = true; setBusy(true); setSaveError(""); setNotice("");
    const nextStatus = item ? item.status === "published" ? "draft" : "published" : status;
    try {
      const { error } = await supabase.rpc("cpp_save_researcher_announcement", {
        p_id: item?.id ?? editing?.id ?? null, p_title: item?.title ?? title, p_body: item?.body ?? body,
        p_status: nextStatus, p_important: item?.is_important ?? important,
      });
      if (!mounted.current) return;
      if (error) throw new Error(error.code === "42501" ? "管理者モードで保存してください。" : error.message);
      if (!item || item.id === editing?.id) edit(null);
      setNotice(nextStatus === "published" ? "研究者向けのお知らせに公開しました。" : item ? "公開を停止しました。内容は下書きとして残っています。" : "下書きを保存しました。");
      setPage(0); setRefresh(n => n + 1);
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message : "保存できませんでした。入力内容を残していますので、もう一度お試しください。");
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return <><CppSectionNav active="announcements" /><main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6"><div className="mx-auto max-w-3xl space-y-6">
    <header className={panel}>
      <p className="text-xs font-bold tracking-widest text-neutral-400">CPP NEWS</p>
      <h1 className="mt-2 text-2xl font-black">{manage ? "研究者向けお知らせ管理" : "研究者向けのお知らせ"}</h1>
      <p className="mt-3 text-sm leading-7 text-neutral-600">{manage ? "CPP研究者に向けた連絡や開催情報を作成します。下書きは管理者だけが閲覧できます。" : "CPPからの連絡や開催情報をお届けします。プロフィールを作成中の方も確認できます。"}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {manage ? <Link className={button} href="/my/cpp/announcements">公開中のお知らせを確認</Link> : result?.can_manage ? <Link className={button} href="/my/cpp/admin/researcher-announcements">お知らせを管理</Link> : null}
        <Link className={button} href="/my/cpp/home">CPPホームへ</Link>
      </div>
    </header>
    {loadError ? <div className={panel}><p role="alert" className="text-sm text-red-700">{loadError}</p><button type="button" className={`${button} mt-4`} onClick={() => setRefresh(n => n + 1)}>再読み込み</button></div> : null}
    {manage && result?.can_manage ? <form ref={editor} className={`${panel} scroll-mt-24`} onSubmit={event => { event.preventDefault(); void save(); }}>
      <h2 className="mb-5 text-xl font-bold">{editing ? "お知らせを編集" : "新しいお知らせ"}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-bold">タイトル<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={input} /></label>
        <label className="block text-sm font-bold">本文<textarea required rows={8} maxLength={10000} value={body} onChange={event => setBody(event.target.value)} className={input} /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={important} onChange={event => setImportant(event.target.checked)} />重要なお知らせとして先頭に表示</label>
        <label className="block text-sm font-bold">公開状態<select value={status} onChange={event => setStatus(event.target.value as Announcement["status"])} className={input}><option value="draft">下書き（非公開）</option><option value="published">研究者に公開</option></select></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className={primary} disabled={busy || !title.trim() || !body.trim()}>{busy ? "保存中…" : status === "published" ? "保存して公開する" : "下書きを保存"}</button>{editing ? <button type="button" className={button} onClick={() => edit(null)}>編集をやめる</button> : null}</div>
      </fieldset>
    </form> : null}
    {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
    {notice ? <p role="status" className="text-sm text-emerald-800">{notice}</p> : null}
    <section aria-label={manage ? "作成したお知らせ" : "公開中のお知らせ"} className="space-y-4">
      {manage && result ? <h2 className="text-xl font-bold">作成したお知らせ</h2> : null}
      {loading ? <p role="status">お知らせを読み込んでいます…</p> : result?.items.map(item => <article id={item.id} key={item.id} className={`${panel} scroll-mt-24 ${item.is_important ? "border-amber-200 bg-amber-50" : ""}`}>
        {manage || item.is_important ? <p className="text-xs font-bold text-amber-900">{manage ? item.status === "published" ? "公開中" : "下書き・非公開" : ""}{item.is_important ? `${manage ? " · " : ""}重要なお知らせ` : ""}</p> : null}
        <h3 className="mt-2 break-words text-lg font-bold">{item.title}</h3>
        <p className="mt-1 text-xs text-neutral-500">{dateLabel(item.published_at ?? item.created_at)}</p>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p>
        {manage ? <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} disabled={busy} onClick={() => edit(item)}>編集</button><button type="button" className={button} disabled={busy} onClick={() => void save(item)}>{item.status === "published" ? "公開を停止" : "公開する"}</button></div> : null}
      </article>)}
      {!loading && result?.total === 0 ? <p className={`${panel} text-sm text-neutral-600`}>{manage ? "まだお知らせを作成していません。" : "現在、お知らせはありません。"}</p> : null}
    </section>
    {result && result.total > PAGE_SIZE ? <nav aria-label="お知らせのページ" className="flex items-center justify-between gap-3">
      <button type="button" className={button} disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>前へ</button>
      <span className="text-sm">{page + 1} / {Math.ceil(result.total / PAGE_SIZE)}</span>
      <button type="button" className={button} disabled={busy || (page + 1) * PAGE_SIZE >= result.total} onClick={() => setPage(n => n + 1)}>次へ</button>
    </nav> : null}
    {!manage ? <p className="text-center text-sm"><Link href="/my/announcements" className="text-neutral-600 underline">PARARI全体のお知らせ</Link></p> : null}
  </div></main></>;
}
