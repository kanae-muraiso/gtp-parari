"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import CppMessageRecipient from "../messages/CppMessageRecipient";
import AlumniFeed from "./AlumniFeed";
import { AlumniAccess, AlumniTitle, MemberLink, alumniRpc, button, dateLabel, memberHref, message, panel, useAlumni, type AlumniMember, type AlumniNews } from "./AlumniShared";

export function AlumniMembers({ preview = false }: { preview?: boolean }) {
  const [members, setMembers] = useState<AlumniMember[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const limit = preview ? 5 : 30;
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void alumniRpc<{ members: AlumniMember[]; total: number }>("cpp_alumni_community_members", { p_limit: limit }).then(data => {
      if (active) { setMembers(data.members); setTotal(data.total); setOffset(data.members.length); }
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit, retry]);
  const more = async () => {
    setBusy(true); setError("");
    try {
      const data = await alumniRpc<{ members: AlumniMember[]; total: number }>("cpp_alumni_community_members", { p_limit: limit, p_offset: offset });
      setMembers(current => [...current, ...data.members.filter(m => !current.some(c => c.user_id === m.user_id))]); setTotal(data.total); setOffset(current => current + data.members.length);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    {preview ? <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">最近の登録者</h2><Link href="/cpp/alumni/members" className="text-sm font-bold text-sky-800 underline">参加者一覧を見る →</Link></div> : <p className="text-sm text-neutral-600">{total}人の参加者 · 登録が新しい順</p>}
    {loading ? <p role="status" className="text-sm text-neutral-500">参加者を読み込んでいます…</p> : <div className="grid gap-3 sm:grid-cols-2">{members.map(member => <MemberLink key={member.user_id} member={member} />)}</div>}
    {!loading && !error && !members.length ? <p className={panel}>まだ参加者はいません。</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>再読み込み</button></p> : null}
    {!preview && !loading && offset < total ? <button className={button} disabled={busy} onClick={() => void more()} type="button">{busy ? "読み込み中…" : "さらに参加者を見る"}</button> : null}
  </section>;
}

export function AlumniAnnouncements({ preview = false }: { preview?: boolean }) {
  const [items, setItems] = useState<AlumniNews[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const limit = preview ? 3 : 20;
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void alumniRpc<{ items: AlumniNews[]; total: number }>("cpp_alumni_news", { p_limit: limit }).then(data => {
      if (active) { setItems(data.items); setTotal(data.total); setOffset(data.items.length); }
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit, retry]);
  useEffect(() => {
    if (!preview && !loading && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loading, preview]);
  const more = async () => {
    setBusy(true); setError("");
    try {
      const data = await alumniRpc<{ items: AlumniNews[]; total: number }>("cpp_alumni_news", { p_limit: limit, p_offset: offset });
      setItems(current => [...current, ...data.items.filter(x => !current.some(c => c.id === x.id))]); setTotal(data.total); setOffset(current => current + data.items.length);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    {preview ? <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">お知らせ</h2><Link href="/cpp/alumni/announcements" className="text-sm font-bold text-sky-800 underline">すべて見る →</Link></div> : null}
    {loading ? <p role="status" className="text-sm text-neutral-500">お知らせを読み込んでいます…</p> : items.map(item => <article id={item.id} key={item.id} className={`scroll-mt-24 ${panel} ${item.is_important ? "border-amber-200 bg-amber-50" : ""}`}>
      {item.is_important ? <p className="mb-2 text-xs font-bold text-amber-900">大切なお知らせ</p> : null}
      <h3 className="text-lg font-bold">{preview ? <Link href={`/cpp/alumni/announcements#${item.id}`} className="hover:underline">{item.title}</Link> : item.title}</h3>
      <time className="mt-2 block text-xs text-neutral-500" dateTime={item.published_at ?? item.created_at}>{dateLabel(item.published_at ?? item.created_at)}</time>
      <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${preview ? "line-clamp-3" : ""}`}>{item.body}</p>
      {preview ? <Link href={`/cpp/alumni/announcements#${item.id}`} className="mt-3 inline-block text-sm text-sky-800 underline">全文を読む →</Link> : null}
    </article>)}
    {!loading && !items.length && !error ? <p className={`${panel} text-sm text-neutral-600`}>現在、お知らせはありません。</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>再読み込み</button></p> : null}
    {!preview && !loading && offset < total ? <button type="button" disabled={busy} className={button} onClick={() => void more()}>{busy ? "読み込み中…" : "以前のお知らせを見る"}</button> : null}
  </section>;
}

function HomeContent() {
  const context = useAlumni();
  return <>
    <header className="rounded-3xl bg-sky-950 p-6 text-white sm:p-9">
      <p className="text-xs font-bold tracking-widest text-sky-200">CPP ALUMNI</p>
      <h1 className="mt-3 text-3xl font-black">CPP同窓会</h1>
      <p className="mt-3 text-sm leading-7 text-sky-100">あのときの仲間と、いまの話を。<br />近況を伝えたり、懐かしい顔を探したり、気軽にお立ち寄りください。</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {context.is_alumni ? <Link className={button} href={memberHref(context.user_id)}>自分のページ</Link> : null}
        {context.is_admin ? <Link className={button} href="/my/cpp/admin/announcements">お知らせを管理</Link> : null}
      </div>
    </header>
    <AlumniAnnouncements preview />
    <AlumniMembers preview />
    <AlumniFeed preview composer />
  </>;
}
export function AlumniHome() { return <AlumniAccess><HomeContent /></AlumniAccess>; }
export function AlumniMemberListPage() { return <AlumniAccess><AlumniTitle title="参加者一覧">登録が新しい順に並んでいます。名前を押すと、その人の紹介と近況を見られます。</AlumniTitle><AlumniMembers /></AlumniAccess>; }
export function AlumniFeedPage() { return <AlumniAccess><AlumniTitle title="みんなの近況">CPP同窓会の仲間と、最近の出来事を伝え合いましょう。</AlumniTitle><AlumniFeed composer /></AlumniAccess>; }
export function AlumniNewsPage() { return <AlumniAccess><AlumniTitle title="同窓会のお知らせ" /><AlumniAnnouncements /></AlumniAccess>; }

function MemberContent({ userId }: { userId: string }) {
  const context = useAlumni();
  const [member, setMember] = useState<AlumniMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; setLoading(true); setMember(null); setError("");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) { setLoading(false); return; }
    void alumniRpc<{ members: AlumniMember[] }>("cpp_alumni_community_members", { p_user_id: userId, p_limit: 1 }).then(data => {
      if (active) setMember(data.members[0] ?? null);
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);
  if (loading) return <p role="status">参加者を読み込んでいます…</p>;
  if (error) return <p role="alert" className={panel}>{error}</p>;
  if (!member) return <div className={panel}>参加者が見つかりません。<Link className="ml-3 text-sky-800 underline" href="/cpp/alumni/members">参加者一覧へ</Link></div>;
  return <>
    <AlumniTitle title={`${member.display_name}さんの同窓会ページ`} />
    <SocialProfileCard displayName={member.display_name} photoUrl={member.photo_url} affiliation={member.affiliation} roleTitle={member.role_title} topics={member.topics} intro={member.intro} />
    <div className="flex flex-wrap items-center gap-3"><CppMessageRecipient userId={userId} />{context.user_id === userId ? <><Link className={button} href="/cpp/alumni?edit=1">同窓会の登録内容を編集</Link><Link className={button} href={`/my/cpp/social-profile?returnTo=${encodeURIComponent(memberHref(userId))}`}>名札を編集</Link></> : null}</div>
    <section className={panel}><h2 className="text-lg font-bold">CPPでの思い出</h2>
      <div className="mt-3 flex flex-wrap gap-2">{member.participations.map(p => <span key={`${p.year}:${p.location}`} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900">{p.year}年 · {p.location}</span>)}</div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{member.cpp_memory}</p>
    </section>
    <h2 className="text-xl font-bold">近況報告</h2><AlumniFeed key={userId} userId={userId} composer={context.user_id === userId} />
  </>;
}
export function AlumniIndividualPage({ userId }: { userId: string }) { return <AlumniAccess><MemberContent userId={userId} /></AlumniAccess>; }
