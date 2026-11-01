"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";

type Shelf = {
  follows: {author_user_id:string}[];
  stars: {work_id:string}[];
  reading: {work_id:string;state:string}[];
  categories: {id:string;name:string}[];
  categoryItems: {category_id:string;target_kind:string;target_id:string}[];
};
type Work = {id:string;title:string|null;owner:string};
type Author = {user_id:string;username:string|null;display_name:string|null};
const tabs = [{id:"mine",name:"自分の作品"},{id:"authors",name:"作者別"},{id:"later",name:"これから読む"},{id:"read",name:"読んだ"},{id:"stars",name:"お気に入り"}] as const;
type Tab = typeof tabs[number]["id"];
export default function LibraryV2Page() {
  const [tab,setTab] = useState<Tab>("authors");
  const [data,setData] = useState<Shelf|null>(null);
  const [works,setWorks] = useState<Work[]>([]);
  const [authors,setAuthors] = useState<Author[]>([]);
  const [me,setMe] = useState<string|null>(null);
  const [category,setCategory] = useState("");
  const [message,setMessage] = useState("書棚を読み込んでいます…");
  async function load() {
    if (!supabase) {setMessage("接続設定がありません。");return;}
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) {setMessage("ログインが必要です。");return;}
    setMe(session.user.id);
    const res = await fetch("/api/library-v2",{headers:{Authorization:"Bearer "+session.access_token}});
    if (!res.ok) {setMessage("書棚を読み込めませんでした。");return;}
    const shelf = await res.json() as Shelf;
    setData(shelf);
    const ids = [...new Set([...shelf.stars.map(x=>x.work_id),...shelf.reading.map(x=>x.work_id)])];
    const authorIds = [...new Set(shelf.follows.map(x=>x.author_user_id))];
    const [own, saved, people] = await Promise.all([
      supabase.from("parari_books").select("id,title,owner").eq("owner",session.user.id).eq("is_deleted",false).order("updated_at",{ascending:false}).limit(200),
      ids.length ? supabase.from("parari_books").select("id,title,owner").in("id",ids) : Promise.resolve({data:[],error:null}),
      authorIds.length ? supabase.from("profiles").select("user_id,username,display_name").in("user_id",authorIds) : Promise.resolve({data:[],error:null}),
    ]);
    if (own.error || saved.error || people.error) {setMessage("一部の作品を取得できませんでした。");return;}
    setWorks([...new Map([...(own.data??[]),...(saved.data??[])].map(x=>[x.id,x as Work])).values()]);
    setAuthors((people.data??[]) as Author[]);
    setMessage("");
  }
  useEffect(()=>{void load();},[]);
  async function addCategory() {
    if (!supabase || !category.trim()) return;
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/library-v2",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"category",name:category.trim()})});
    if (!res.ok) {setMessage("カテゴリーを作成できませんでした。");return;}
    setCategory(""); await load();
  }
  const selected = works.filter(w=>tab==="mine" ? w.owner===me : tab==="stars" ? data?.stars.some(s=>s.work_id===w.id) : tab==="later" ? data?.reading.some(s=>s.work_id===w.id && (s.state==="to_read" || s.state==="reading")) : data?.reading.some(s=>s.work_id===w.id && s.state==="read"));
  return <main className="min-h-screen bg-white">
    <div className="mx-auto max-w-4xl px-4 py-6">
      <MyAreaHeader title="書棚" area="library" navigation={<MyPrimaryTabs active="bookshelf" embedded/>}/>
      <div className="mt-6">
        <h1 className="text-xl font-bold">書棚</h1>
        <p className="mt-1 text-sm text-neutral-500">作品と作者を、自分の関心で整理します。</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="書棚の表示">
          {tabs.map(t=><button type="button" role="tab" aria-selected={tab===t.id} key={t.id} onClick={()=>setTab(t.id)}
            className={"rounded-full border px-3 py-2 text-sm "+(tab===t.id?"bg-neutral-900 text-white":"bg-white text-neutral-800")}>{t.name}</button>)}
        </div>
        {message && <p role="status" className="mt-5 text-sm text-neutral-600">{message}</p>}
        <section className="mt-6">
          {tab==="authors" ? <div className="grid gap-3 sm:grid-cols-2">{authors.map(a=><Link key={a.user_id} href={a.username?"/"+encodeURIComponent(a.username)+"/library":"#"}
            className="rounded-xl border border-neutral-200 p-4 font-medium">{a.display_name||a.username||"作者"}</Link>)}
            {!message && authors.length===0 && <p className="text-sm text-neutral-500">まだファン登録した作者はいません。</p>}</div>
          : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{selected.map(w=><Link key={w.id} href={"/p/"+w.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="mb-2 aspect-[3/4] rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">▤</div>
              <span className="text-sm font-medium">{w.title||"無題の作品"}</span></Link>)}
            {!message && selected.length===0 && <p className="text-sm text-neutral-500">該当する作品はありません。</p>}</div>}
        </section>
        <section className="mt-8 border-t border-neutral-200 pt-5">
          <h2 className="font-semibold">カテゴリー</h2>
          <div className="mt-3 flex flex-wrap gap-2">{data?.categories.map(c=><span key={c.id} className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{c.name}</span>)}</div>
          <div className="mt-3 flex gap-2">
            <input aria-label="新しいカテゴリー" value={category} onChange={e=>setCategory(e.target.value)} maxLength={80} placeholder="例：ZUMBA、文学" className="min-w-0 flex-1 rounded-lg border px-3 py-2"/>
            <button type="button" onClick={addCategory} className="rounded-lg border px-4 py-2 text-sm">追加</button>
          </div>
        </section>
        <p className="mt-8 text-xs text-neutral-500">試験版。既存の書棚・購入・申込・メンバーシップには影響しません。</p>
      </div>
    </div>
  </main>;
}
