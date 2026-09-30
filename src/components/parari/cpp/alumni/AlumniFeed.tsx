"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { alumniRpc, button, dateLabel, input, memberHref, message, panel, primary, useAlumni, type AlumniPost } from "./AlumniShared";

export function AlumniComposer({ post, onSaved, onCancel }: { post?: AlumniPost; onSaved: () => void; onCancel?: () => void }) {
  const { user_id } = useAlumni();
  const draftKey = `cpp-alumni-draft:${user_id}`;
  const [body, setBody] = useState(post?.body ?? "");
  const [url, setUrl] = useState(post?.work_url ?? "");
  const [ready, setReady] = useState(Boolean(post));
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  useEffect(() => {
    if (post) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as { body?: string; url?: string };
        setBody(typeof draft.body === "string" ? draft.body : "");
        setUrl(typeof draft.url === "string" ? draft.url : "");
      }
    } catch { setDraftWarning("このブラウザでは書きかけを保持できません。移動する前に文章をコピーしてください。"); }
    setReady(true);
  }, [draftKey, post]);
  const change = (nextBody: string, nextUrl: string) => {
    setBody(nextBody); setUrl(nextUrl);
    if (!post) {
      try { sessionStorage.setItem(draftKey, JSON.stringify({ body: nextBody, url: nextUrl })); }
      catch { setDraftWarning("書きかけを保持できません。移動前に文章をコピーしてください。"); }
    }
  };
  const save = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      await alumniRpc("cpp_alumni_save_update", { p_body: body, p_work_url: url || null, p_id: post?.id ?? null });
      if (!post) {
        setBody(""); setUrl("");
        try { sessionStorage.removeItem(draftKey); } catch { /* Posting already succeeded. */ }
      }
      onSaved();
    } catch (e) { setError(message(e)); }
    finally { submitting.current = false; setBusy(false); }
  };
  const count = Array.from(body.trim()).length;
  return <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3">
    <fieldset disabled={!ready || busy} className="space-y-3">
      <label className="block text-sm font-bold">{post ? "近況を編集" : "近況をひとこと"}
        <textarea className={`${input} mt-2`} rows={3} value={body} onChange={e => change(e.target.value, url)} placeholder="最近の出来事など、2〜3行でどうぞ。" required />
      </label>
      <p className={`text-right text-xs ${count > 200 ? "text-red-700" : "text-neutral-500"}`}>{count} / 200文字</p>
      <label className="block text-sm">PARARIの作品URL（任意）
        <input type="url" className={`${input} mt-2`} value={url} maxLength={2048} onChange={e => change(body, e.target.value)} placeholder="https://www.parari.app/…" />
      </label>
      <p className="text-xs leading-6 text-neutral-500">近況は同窓会内に表示されます。リンク先の作品には、PARARI側の公開設定が適用されます。</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={primary} disabled={busy || count < 1 || count > 200} type="submit">{busy ? "保存中…" : post ? "変更を保存" : "投稿する"}</button>
        {onCancel ? <button type="button" className={button} onClick={onCancel}>キャンセル</button> : <Link href="/editor/quick" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-sky-800 underline">長文はPARARIで書く ↗</Link>}
      </div>
    </fieldset>
    {!post ? <p className="text-xs leading-6 text-neutral-500">「投稿する」を押すまで公開されません。書きかけはこのタブに保持されます。</p> : null}
    {draftWarning ? <p role="status" className="text-xs text-amber-800">{draftWarning}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </form>;
}

function PostCard({ post, onChanged }: { post: AlumniPost; onChanged: () => void }) {
  const context = useAlumni();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const action = async (kind: "delete" | "moderate") => {
    if (busy) return;
    if (kind === "delete" && !window.confirm("この近況を削除しますか？")) return;
    setBusy(true); setError("");
    try {
      await alumniRpc(kind === "delete" ? "cpp_alumni_delete_update" : "cpp_alumni_moderate_update", kind === "delete" ? { p_id: post.id } : { p_id: post.id, p_hidden: !post.hidden_at });
      onChanged();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  };
  return <article className="rounded-2xl border border-neutral-200 bg-white p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <Link href={memberHref(post.user_id)} className="font-bold text-sky-900 hover:underline">{post.display_name}</Link>
      <time dateTime={post.created_at} className="text-xs text-neutral-500">{dateLabel(post.created_at)}{post.updated_at !== post.created_at ? "（編集済み）" : ""}</time>
    </div>
    {post.hidden_at ? <p className="mt-2 text-xs font-bold text-red-700">非表示中（管理者にのみ表示）</p> : null}
    {editing ? <div className="mt-4"><AlumniComposer post={post} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} /></div> : <>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-neutral-800">{post.body}</p>
      {post.work_url ? <a className="mt-3 inline-block text-sm font-bold text-sky-800 underline" href={post.work_url} target="_blank" rel="noopener noreferrer">PARARIで続きを読む ↗</a> : null}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-600">
        {context.user_id === post.user_id ? <><button type="button" disabled={busy} onClick={() => setEditing(true)} className="underline">編集</button><button type="button" disabled={busy} onClick={() => void action("delete")} className="underline">削除</button></> : null}
        {context.is_admin ? <button type="button" disabled={busy} onClick={() => void action("moderate")} className="text-red-700 underline">{post.hidden_at ? "再表示する" : "管理者として非表示にする"}</button> : null}
      </div>
    </>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </article>;
}

export default function AlumniFeed({ userId, preview = false, composer = false }: { userId?: string; preview?: boolean; composer?: boolean }) {
  const context = useAlumni();
  const limit = preview ? 5 : 20;
  const [posts, setPosts] = useState<AlumniPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(n => n + 1);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void alumniRpc<{ posts: AlumniPost[]; total: number }>("cpp_alumni_feed", { p_user_id: userId ?? null, p_limit: limit }).then(data => {
      if (active) { setPosts(data.posts); setTotal(data.total); setOffset(data.posts.length); }
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, limit, refresh]);
  const more = async () => {
    setMoreBusy(true); setError("");
    try {
      const data = await alumniRpc<{ posts: AlumniPost[]; total: number }>("cpp_alumni_feed", { p_user_id: userId ?? null, p_limit: limit, p_offset: offset });
      setPosts(current => [...current, ...data.posts.filter(p => !current.some(c => c.id === p.id))]); setTotal(data.total); setOffset(current => current + data.posts.length);
    } catch (e) { setError(message(e)); } finally { setMoreBusy(false); }
  };
  return <section className="space-y-4">
    {composer && context.is_alumni ? <div className={`${panel} border-sky-200 bg-sky-50`}><AlumniComposer onSaved={reload} /></div> : null}
    {preview ? <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">最近の近況報告</h2><Link href="/cpp/alumni/feed" className="text-sm font-bold text-sky-800 underline">すべて見る →</Link></div> : null}
    {loading ? <p role="status" className="text-sm text-neutral-500">近況を読み込んでいます…</p> : posts.length ? posts.map(post => <PostCard key={post.id} post={post} onChanged={reload} />) : !error ? <p className={`${panel} text-sm text-neutral-600`}>まだ近況の投稿はありません。</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={reload}>再読み込み</button></p> : null}
    {!preview && !loading && offset < total ? <button type="button" className={button} disabled={moreBusy} onClick={() => void more()}>{moreBusy ? "読み込み中…" : "以前の近況を見る"}</button> : null}
  </section>;
}
