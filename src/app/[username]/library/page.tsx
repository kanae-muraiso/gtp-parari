"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Work = { id:string; title:string|null; stable_slug:string|null; slug:string|null; updated_at:string|null };
type Author = { user_id:string; username:string; display_name:string|null; introduction_work_id:string|null };
export default function AuthorLibraryPage() {
  const { username: raw } = useParams<{username:string}>();
  const username = decodeURIComponent(raw);
  const [author,setAuthor] = useState<Author|null>(null);
  const [works,setWorks] = useState<Work[]>([]);
  const [following,setFollowing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("読み込み中…");
  const load = useCallback(async () => {
    if (!supabase) { setMessage("接続設定がありません。"); return; }
    const {data: profile,error} = await supabase.from("profiles")
      .select("user_id,username,display_name,introduction_work_id")
      .eq("username",username).maybeSingle();
    if (error || !profile) { setMessage("作者が見つかりません。"); return; }
    const a = profile as Author;
    setAuthor(a);
    const {data: books,error: workError} = await supabase.from("parari_books")
      .select("id,title,stable_slug,slug,updated_at")
      .eq("owner",a.user_id).eq("visibility","public")
      .eq("show_in_profile_works",true).eq("is_deleted",false)
      .or("expires_at.is.null,expires_at.gt."+new Date().toISOString())
      .order("updated_at",{ascending:false}).limit(200);
    if (workError) { setMessage("公開作品を読み込めませんでした。"); return; }
    setWorks((books ?? []) as Work[]);
    setMessage("");
    const {data:{user}} = await supabase.auth.getUser();
    if (user) {
      const {data} = await supabase.from("parari_author_follows")
        .select("author_user_id").eq("follower_user_id",user.id)
        .eq("author_user_id",a.user_id).maybeSingle();
      setFollowing(Boolean(data));
    }
  },[username]);
  useEffect(()=>{void load();},[load]);
  async function toggleFollow() {
    if (!supabase || !author || busy) return;
    setBusy(true);
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setMessage("ファン登録にはログインが必要です。"); return; }
      const res = await fetch("/api/library-v2",{
        method:following?"DELETE":"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({action:"follow",authorId:author.user_id}),
      });
      if (!res.ok) { setMessage("登録を更新できませんでした。"); return; }
      setFollowing(!following); setMessage("");
    } finally {setBusy(false);}
  }
  const label = author?.display_name || author?.username || username;
  return <main className="min-h-screen bg-white px-4 py-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-neutral-200 pb-5">
        <p className="text-xs text-neutral-500">PARARI / 作者の書棚</p>
        <h1 className="mt-2 text-2xl font-bold">{label}の書棚</h1>
        {author && <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={toggleFollow}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
            {following?"♡ ファン登録済み":"♡ この作者のファンになる"}
          </button>
          {author.introduction_work_id && <Link className="rounded-full border border-neutral-300 px-4 py-2 text-sm"
            href={"/p/"+author.introduction_work_id}>自己紹介を読む</Link>}
        </div>}
      </header>
      {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      <section aria-label="公開作品">
        <h2 className="mb-4 text-lg font-semibold">公開作品</h2>
        {author && !message && works.length===0 && <p className="text-sm text-neutral-500">現在、公開作品はありません。</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {works.map(work=><Link key={work.id} href={"/p/"+work.id}
            className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
            <div className="mb-3 flex aspect-[3/4] items-center justify-center rounded-lg bg-neutral-100 text-3xl" aria-hidden>▤</div>
            <p className="font-medium">{work.title || "無題の作品"}</p>
          </Link>)}
        </div>
      </section>
    </div>
  </main>;
}
