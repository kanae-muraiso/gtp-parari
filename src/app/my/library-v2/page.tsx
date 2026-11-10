"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";
import { parseParari } from "@/lib/parariParse";

type Shelf = {
  follows: {author_user_id:string}[];
  stars: {work_id:string}[];
  reading: {work_id:string;state:string;updated_at:string|null}[];
  categories: {id:string;name:string}[];
  categoryItems: {category_id:string;target_kind:string;target_id:string}[];
};
type Work = {id:string;title:string|null;owner:string;content:string|null};
function coverOf(work:Work):string {
  if (!work.content) return "";
  try {
    const parsed=parseParari(work.content);
    return parsed.bookCoverImage || parsed.pages?.[0]?.imageUrl || "";
  } catch {return "";}
}
type ShelfActivity = {book_id:string;type:string;created_at:string|null};
type ReadingWork = {work:Work;date:string|null;author:string};

async function loadShelfActivity(userId:string) {
  if (!supabase) return { rows:[] as ShelfActivity[], failed:true };
  const rows:ShelfActivity[] = [];
  const pageSize = 500;
  for (let offset=0; ;offset+=pageSize) {
    const result = await supabase.from("user_bookshelf")
      .select("book_id,type,created_at").eq("user_id",userId)
      .in("type",["shelf","read_later","viewed"])
      .order("created_at",{ascending:false}).order("id")
      .range(offset,offset+pageSize-1);
    if (result.error) return { rows, failed:true };
    const page = (result.data ?? []) as ShelfActivity[];
    rows.push(...page);
    if (page.length<pageSize) return { rows, failed:false };
  }
}

function batches(ids:string[]) {
  const result:string[][] = [];
  for (let start=0;start<ids.length;start+=100) result.push(ids.slice(start,start+100));
  return result;
}

function ReadingShelfRow({title, items, showDate}: {title:string;items:ReadingWork[];showDate?:boolean}) {
  const [expanded,setExpanded] = useState(false);
  const [search,setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visible = expanded
    ? items.filter(({work,author}) => `${work.title ?? ""} ${author}`.toLocaleLowerCase().includes(query))
    : items.slice(0,5);

  return <section className="min-w-0 rounded-2xl border border-neutral-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length>5 && <button type="button" aria-expanded={expanded}
        className="text-sm font-medium text-sky-800 underline underline-offset-4"
        onClick={()=>{setExpanded(!expanded);setSearch("");}}>
        {expanded?"閉じる":`すべて見る（${items.length}件）`}
      </button>}
    </div>
    {expanded && <input type="search" aria-label={`${title}を絞り込む`} placeholder="作品名・著者名で絞り込む"
      className="mt-3 w-full rounded-lg border px-3 py-2 text-sm sm:max-w-xs"
      value={search} onChange={e=>setSearch(e.target.value)} />}
    {visible.length===0 ? <p className="mt-3 text-sm text-neutral-500">
      {query?"該当する作品はありません。":showDate?"まだ開いた作品はありません。":"「あとで読む」に追加した作品がここに並びます。"}
    </p> : <ul className={`mt-3 grid gap-3 pb-2 md:grid-cols-5 ${expanded
      ? "grid-cols-2 sm:grid-cols-3"
      : "auto-cols-[42%] grid-flow-col snap-x overflow-x-auto sm:auto-cols-[29%] md:auto-cols-auto md:grid-flow-row"}`}>
      {visible.map(({work,date,author})=>{
        const cover = coverOf(work);
        const title = work.title || "無題の作品";
        return <li key={work.id} className="min-w-0 snap-start">
          <Link href={`/p/${work.id}`} className="block rounded-lg hover:underline">
            <div className="mb-2 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-sky-50 text-sky-950">
              {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover"/> :
                <span aria-hidden="true" className="line-clamp-4 break-all px-3 text-center text-sm font-semibold">{title}</span>}
            </div>
            <p className="break-words text-sm font-medium">{title}</p>
            {author && <p className="break-words text-xs text-neutral-600">{author}</p>}
            {showDate && date && <time className="text-xs text-neutral-500" dateTime={date}>
              {new Date(date).toLocaleDateString("ja-JP")}
            </time>}
          </Link>
        </li>;
      })}
    </ul>}
  </section>;
}

type Author = {user_id:string;username:string|null;display_name:string|null};
const tabs = [{id:"mine",name:"自分の作品"},{id:"authors",name:"作者別"},{id:"history",name:"読書履歴"},{id:"read",name:"読んだ"},{id:"stars",name:"お気に入り"}] as const;
type Tab = typeof tabs[number]["id"];
export default function LibraryV2Page() {
  const [tab,setTab] = useState<Tab>("authors");
  const [data,setData] = useState<Shelf|null>(null);
  const [works,setWorks] = useState<Work[]>([]);
  const [activity,setActivity] = useState<ShelfActivity[]>([]);
  const [activityError,setActivityError] = useState(false);
  const [workAuthors,setWorkAuthors] = useState<Author[]>([]);
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
    const authorIds = [...new Set(shelf.follows.map(x=>x.author_user_id))];
    const [own, people, {rows,failed}] = await Promise.all([
      supabase.from("parari_books").select("id,title,owner,content").eq("owner",session.user.id).eq("is_deleted",false).order("updated_at",{ascending:false}).limit(200),
      authorIds.length ? supabase.from("profiles").select("user_id,username,display_name").in("user_id",authorIds) : Promise.resolve({data:[],error:null}),
      loadShelfActivity(session.user.id),
    ]);
    setActivityError(failed);
    const ids = [...new Set([...shelf.stars.map(x=>x.work_id),...shelf.reading.map(x=>x.work_id),...rows.map(x=>x.book_id)])];
    const saved = await Promise.all(batches(ids).map(batch=>
      supabase!.from("parari_books").select("id,title,owner,content").in("id",batch).or("is_deleted.is.null,is_deleted.eq.false"),
    ));
    if (own.error || saved.some(result=>result.error) || people.error) {setMessage("一部の作品を取得できませんでした。");return;}
    const loadedWorks = [...new Map([...(own.data??[]),...saved.flatMap(result=>result.data??[])].map(x=>[x.id,x as Work])).values()];
    const workOwnerIds = [...new Set(loadedWorks.map(work=>work.owner))];
    const workPeople = await Promise.all(batches(workOwnerIds).map(batch=>
      supabase!.from("profiles").select("user_id,username,display_name").in("user_id",batch),
    ));
    setWorks(loadedWorks);
    setWorkAuthors(workPeople.flatMap(result=>result.data??[]) as Author[]);
    setActivity(rows);
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
  const selected = works.filter(w=>tab==="mine" ? w.owner===me : tab==="stars" ? data?.stars.some(s=>s.work_id===w.id) : data?.reading.some(s=>s.work_id===w.id && s.state==="read"));
  const visibleWorks = categoryFilter ? selected.filter(w=>data?.categoryItems.some(i=>i.category_id===categoryFilter && i.target_kind==="work" && i.target_id===w.id)) : selected;
  const visibleAuthors = categoryFilter ? authors.filter(a=>data?.categoryItems.some(i=>i.category_id===categoryFilter && i.target_kind==="author" && i.target_id===a.user_id)) : authors;
  const worksById = new Map(works.map(work=>[work.id,work]));
  const authorsById = new Map(workAuthors.map(author=>[author.user_id,author]));
  function readingItems(entries: {id:string;date:string|null}[]):ReadingWork[] {
    const seen = new Set<string>();
    return [...entries].sort((a,b)=>(b.date ?? "").localeCompare(a.date ?? ""))
      .flatMap(({id,date})=>{
        if (seen.has(id)) return [];
        seen.add(id);
        const work=worksById.get(id);
        if (!work || (categoryFilter && !data?.categoryItems.some(item=>item.category_id===categoryFilter && item.target_kind==="work" && item.target_id===id))) return [];
        const author=authorsById.get(work.owner);
        return [{work,date,author:author?.display_name || author?.username || ""}];
      });
  }
  const later = readingItems([
    ...activity.filter(row=>row.type!=="viewed").map(row=>({id:row.book_id,date:row.created_at})),
    ...(data?.reading ?? []).filter(row=>row.state==="to_read" || row.state==="reading").map(row=>({id:row.work_id,date:row.updated_at})),
  ]);
  const recent = readingItems(activity.filter(row=>row.type==="viewed").map(row=>({id:row.book_id,date:row.created_at})));
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
          : tab==="history" ? <div className="space-y-4">
              {activityError && <p role="status" className="text-sm text-neutral-600">保存・閲覧の記録を読み込めませんでした。</p>}
              <ReadingShelfRow title="あとで読む" items={later} />
              <ReadingShelfRow title="最近開いた作品" items={recent} showDate />
            </div>
          : <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${tab==="mine"?"md:grid-cols-5":""}`}>{visibleWorks.map(w=><div key={w.id} className="min-w-0 rounded-xl border border-neutral-200 p-3"><Link href={"/p/"+w.id} className="block">
              <div className="mb-2 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-neutral-100">{coverOf(w) ? <img src={coverOf(w)} alt="" loading="lazy" className="h-full w-full object-cover"/> : <span className="px-3 text-center text-xs text-neutral-500">表紙画像なし</span>}</div>
              <span className="break-words text-sm font-medium">{w.title||"無題の作品"}</span></Link><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} aria-pressed={Boolean(data?.stars.some(x=>x.work_id===w.id))} onClick={()=>void mutate("star",{workId:w.id},data?.stars.some(x=>x.work_id===w.id)?"DELETE":"POST")} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50">{data?.stars.some(x=>x.work_id===w.id)?"★":"☆"}</button><select aria-label={`${w.title||"作品"}の読書状態`} disabled={busy} value={data?.reading.find(x=>x.work_id===w.id)?.state||""} onChange={e=>void mutate("reading",{workId:w.id,state:e.target.value},e.target.value?"POST":"DELETE")} className="min-w-0 rounded-lg border px-1 py-1 text-xs"><option value="">未設定</option><option value="to_read">あとで読む</option><option value="reading">読書中</option><option value="read">読んだ</option></select></div>{categorySelect("work",w.id)}</div>)}
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
