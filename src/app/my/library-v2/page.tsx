"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";

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
  const [busy,setBusy] = useState(false);
  const [categoryFilter,setCategoryFilter] = useState("");
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
  async function mutate(action:string, payload:Record<string,unknown>, method:"POST"|"DELETE"="POST") {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setMessage("ログインが必要です。"); return; }
      const res = await fetch("/api/library-v2",{
        method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({action,...payload}),
      });
      if (!res.ok) {
        const error = await res.json().catch(()=>({message:"更新できませんでした。"}));
        setMessage(error.message || "更新できませんでした。"); return;
      }
      setMessage(""); await load();
    } finally {setBusy(false);}
  }
  async function addCategory() {
    if (!category.trim()) return;
    await mutate("category",{name:category.trim()});
    setCategory("");
  }
  function categorySelect(kind:"author"|"work",id:string) {
    const assigned = data?.categoryItems.filter(i=>i.target_kind===kind && i.target_id===id) ?? [];
    return <div className="mt-2 flex flex-wrap gap-1">
      {data?.categories.map(c=>{
        const selected = assigned.some(i=>i.category_id===c.id);
        return <button key={c.id} type="button" disabled={busy}
          aria-pressed={selected}
          onClick={()=>void mutate("category_item",{categoryId:c.id,targetKind:kind,targetId:id},selected?"DELETE":"POST")}
          className={"rounded-full border px-2 py-1 text-xs disabled:opacity-50 "+(selected?"bg-neutral-900 text-white":"bg-white")}>
          {selected?"✓ ":"＋ "}{c.name}
        </button>;
      })}
    </div>;
  }
  const selected = works.filter(w=>tab==="mine" ? w.owner===me : tab==="stars" ? data?.stars.some(s=>s.work_id===w.id) : tab==="later" ? data?.reading.some(s=>s.work_id===w.id && (s.state==="to_read" || s.state==="reading")) : data?.reading.some(s=>s.work_id===w.id && s.state==="read"));
  const visibleWorks = categoryFilter ? selected.filter(w=>data?.categoryItems.some(i=>i.category_id===categoryFilter && i.target_kind==="work" && i.target_id===w.id)) : selected;
  const visibleAuthors = categoryFilter ? authors.filter(a=>data?.categoryItems.some(i=>i.category_id===categoryFilter && i.target_kind==="author" && i.target_id===a.user_id)) : authors;
  return <main className="min-h-screen bg-white">
    <div className="mx-auto max-w-4xl px-4 py-6">
      <MyAreaHeader title="書棚" area="library" />
      <LibraryV2Menu active="shelf" />
      <div className="mt-6">
        <h1 className="text-xl font-bold">書棚</h1>
        <p className="mt-1 text-sm text-neutral-500">作品と作者を、自分の関心で整理します。</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="書棚の表示">
          {tabs.map(t=><button type="button" role="tab" aria-selected={tab===t.id} key={t.id} onClick={()=>setTab(t.id)}
            className={"rounded-full border px-3 py-2 text-sm "+(tab===t.id?"bg-neutral-900 text-white":"bg-white text-neutral-800")}>{t.name}</button>)}
        </div>
        {message && <p role="status" className="mt-5 text-sm text-neutral-600">{message}</p>}
        <div className="mt-4 flex items-center gap-2"><label htmlFor="library-category-filter" className="text-sm">カテゴリー</label><select id="library-category-filter" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="rounded-lg border px-2 py-2 text-sm"><option value="">すべて</option>{data?.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <section className="mt-6">
          {tab==="authors" ? <div className="grid gap-3 sm:grid-cols-2">{visibleAuthors.map(a=><div key={a.user_id} className="rounded-xl border border-neutral-200 p-4"><Link href={a.username?"/"+encodeURIComponent(a.username)+"/library":"#"} className="font-medium underline">{a.display_name||a.username||"作者"}</Link>{categorySelect("author",a.user_id)}</div>)}
            {!message && authors.length===0 && <p className="text-sm text-neutral-500">まだファン登録した作者はいません。</p>}</div>
          : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{visibleWorks.map(w=><div key={w.id} className="rounded-xl border border-neutral-200 p-4"><Link href={"/p/"+w.id} className="block">
              <div className="mb-2 aspect-[3/4] rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">▤</div>
              <span className="text-sm font-medium">{w.title||"無題の作品"}</span></Link><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} aria-pressed={Boolean(data?.stars.some(x=>x.work_id===w.id))} onClick={()=>void mutate("star",{workId:w.id},data?.stars.some(x=>x.work_id===w.id)?"DELETE":"POST")} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50">{data?.stars.some(x=>x.work_id===w.id)?"★":"☆"}</button><select aria-label={`${w.title||"作品"}の読書状態`} disabled={busy} value={data?.reading.find(x=>x.work_id===w.id)?.state||""} onChange={e=>void mutate("reading",{workId:w.id,state:e.target.value},e.target.value?"POST":"DELETE")} className="min-w-0 rounded-lg border px-1 py-1 text-xs"><option value="">未設定</option><option value="to_read">これから読む</option><option value="reading">読書中</option><option value="read">読んだ</option></select></div>{categorySelect("work",w.id)}</div>)}
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
