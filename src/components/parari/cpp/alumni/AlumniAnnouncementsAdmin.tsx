"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlumniAccess, AlumniTitle, alumniRpc, button, dateLabel, input, message, panel, primary, type AlumniNews } from "./AlumniShared";

function Manager() {
  const [items, setItems] = useState<AlumniNews[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<AlumniNews | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [important, setImportant] = useState(false);
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void alumniRpc<{ items: AlumniNews[]; total: number }>("cpp_alumni_news", { p_manage: true, p_limit: 30 }).then(data => {
      if (active) { setItems(data.items); setTotal(data.total); }
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);
  const edit = (item: AlumniNews | null) => {
    setEditing(item); setTitle(item?.title ?? ""); setBody(item?.body ?? ""); setStatus(item?.status ?? "draft"); setImportant(item?.is_important ?? false);
    editor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const save = async (item?: AlumniNews) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const nextStatus = item ? (item.status === "published" ? "draft" : "published") : status;
      await alumniRpc("cpp_alumni_save_announcement", { p_id: item?.id ?? editing?.id ?? null, p_title: item?.title ?? title, p_body: item?.body ?? body, p_status: nextStatus, p_important: item?.is_important ?? important });
      if (!item || item.id === editing?.id) edit(null);
      setNotice(nextStatus === "published" ? "同窓会に公開しました。" : "非公開の下書きとして保存しました。");
      setRefresh(n => n + 1);
    } catch (e) { setError(message(e)); } finally { saving.current = false; setBusy(false); }
  };
  const more = async () => {
    setBusy(true); setError("");
    try {
      const data = await alumniRpc<{ items: AlumniNews[]; total: number }>("cpp_alumni_news", { p_manage: true, p_limit: 30, p_offset: items.length });
      setItems(current => [...current, ...data.items.filter(x => !current.some(c => c.id === x.id))]); setTotal(data.total);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <>
    <AlumniTitle title="同窓会のお知らせ管理">同窓会メンバーに向けたお知らせを作成します。下書きは管理者だけが閲覧できます。</AlumniTitle>
    <div className="flex flex-wrap gap-3"><Link className={button} href="/cpp/alumni">同窓会ホームを確認</Link><Link className={button} href="/cpp/alumni/feed">近況の確認・非表示設定</Link></div>
    <form ref={editor} className={`${panel} scroll-mt-24`} onSubmit={e => { e.preventDefault(); void save(); }}>
      <h2 className="mb-5 text-xl font-bold">{editing ? "お知らせを編集" : "新しいお知らせ"}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-bold">タイトル<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className={`${input} mt-2`} /></label>
        <label className="block text-sm font-bold">本文<textarea required rows={7} maxLength={10000} value={body} onChange={e => setBody(e.target.value)} className={`${input} mt-2`} /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} />大切なお知らせとして先頭に表示</label>
        <label className="block text-sm">公開状態<select value={status} onChange={e => setStatus(e.target.value as "draft" | "published")} className={`${input} mt-2`}><option value="draft">下書き（非公開）</option><option value="published">同窓会に公開</option></select></label>
        <div className="flex gap-3"><button type="submit" className={primary} disabled={busy || !title.trim() || !body.trim()}>{busy ? "保存中…" : status === "published" ? "保存して公開する" : "下書きを保存"}</button>{editing ? <button type="button" className={button} onClick={() => edit(null)}>編集をやめる</button> : null}</div>
      </fieldset>
    </form>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-emerald-800">{notice}</p> : null}
    <section className="space-y-4"><h2 className="text-xl font-bold">作成したお知らせ</h2>
      {loading ? <p role="status">読み込み中…</p> : items.map(item => <article className={panel} key={item.id}>
        <p className="text-xs font-bold text-sky-800">{item.status === "published" ? "公開中" : "下書き・非公開"}{item.is_important ? " · 大切なお知らせ" : ""}</p>
        <h3 className="mt-2 text-lg font-bold">{item.title}</h3><p className="mt-1 text-xs text-neutral-500">{dateLabel(item.published_at ?? item.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p>
        <div className="mt-4 flex flex-wrap gap-3"><button className={button} type="button" disabled={busy} onClick={() => edit(item)}>編集</button><button className={button} type="button" disabled={busy} onClick={() => void save(item)}>{item.status === "published" ? "公開を停止" : "公開する"}</button></div>
      </article>)}
      {!loading && !items.length && !error ? <p className="text-sm text-neutral-500">まだお知らせはありません。</p> : null}
      {!loading && items.length < total ? <button type="button" className={button} disabled={busy} onClick={() => void more()}>さらに表示</button> : null}
    </section>
  </>;
}
export default function AlumniAnnouncementsAdmin() { return <AlumniAccess adminOnly><Manager /></AlumniAccess>; }
