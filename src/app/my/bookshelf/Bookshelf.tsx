"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";
import { parseParari } from "@/lib/parariParse";
import BookshelfAnnouncements from "@/components/parari/announcements/BookshelfAnnouncements";

type Shelf = {
  follows: {author_user_id:string}[];
  stars: {work_id:string;created_at:string|null}[];
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
type PersonalShelf = {id:string;name:string;sort_order:number};
type PersonalShelfItem = {shelf_id:string;book_id:string;sort_order:number};

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

async function loadPersonalShelves(userId:string) {
  if (!supabase) throw new Error("Missing connection");
  const {data, error} = await supabase.from("user_shelves")
    .select("id,name,sort_order").eq("user_id",userId)
    .order("sort_order").order("created_at").order("id");
  if (error) throw error;

  const shelves = (data ?? []) as PersonalShelf[];
  const groups = await Promise.all(batches(shelves.map(shelf=>shelf.id)).map(async ids=>{
    const items:PersonalShelfItem[] = [];
    const pageSize = 500;
    for (let offset=0; ;offset+=pageSize) {
      const result = await supabase!.from("user_shelf_items")
        .select("shelf_id,book_id,sort_order").in("shelf_id",ids)
        .order("sort_order").order("created_at").order("book_id").order("shelf_id")
        .range(offset,offset+pageSize-1);
      if (result.error) throw result.error;
      const page = (result.data ?? []) as PersonalShelfItem[];
      items.push(...page);
      if (page.length<pageSize) return items;
    }
  }));
  return {shelves, items:groups.flat()};
}

function ReadingShelfRow({title, items, emptyMessage, showDate, renderActions}: {
  title:string;
  items:ReadingWork[];
  emptyMessage:string;
  showDate?:boolean;
  renderActions?:(work:Work)=>ReactNode;
}) {
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
      {query?"該当する作品はありません。":emptyMessage}
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
          {renderActions?.(work)}
        </li>;
      })}
    </ul>}
  </section>;
}

type Author = {user_id:string;username:string|null;display_name:string|null};
const tabs = [{id:"mine",name:"自分の作品"},{id:"authors",name:"作者別"},{id:"history",name:"読書履歴"},{id:"shelves",name:"自分の棚"}] as const;
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
  const [showCategoryForm,setShowCategoryForm] = useState(false);
  const [personalShelves,setPersonalShelves] = useState<PersonalShelf[]|null>(null);
  const [personalShelfItems,setPersonalShelfItems] = useState<PersonalShelfItem[]>([]);
  const [shelfName,setShelfName] = useState("");
  const [showShelfForm,setShowShelfForm] = useState(false);
  const [shelfMessage,setShelfMessage] = useState("");
  const [message,setMessage] = useState("読み込み中…");
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
    const [own, people, {rows,failed}, personal] = await Promise.all([
      supabase.from("parari_books").select("id,title,owner,content").eq("owner",session.user.id).eq("is_deleted",false).order("updated_at",{ascending:false}).limit(200),
      authorIds.length ? supabase.from("profiles").select("user_id,username,display_name").in("user_id",authorIds) : Promise.resolve({data:[],error:null}),
      loadShelfActivity(session.user.id),
      loadPersonalShelves(session.user.id).catch(()=>null),
    ]);
    setActivityError(failed);
    const ids = [...new Set([...shelf.stars.map(x=>x.work_id),...shelf.reading.map(x=>x.work_id),...rows.map(x=>x.book_id),...(personal?.items ?? []).map(x=>x.book_id)])];
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
    if (personal) {
      setPersonalShelves(personal.shelves);
      setPersonalShelfItems(personal.items);
      setShelfMessage("");
    } else {
      setPersonalShelves(null);
      setPersonalShelfItems([]);
      setShelfMessage("自分の棚を読み込めませんでした。");
    }
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
      return true;
    } finally {setBusy(false);}
  }
  async function addCategory(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = category.trim();
    if (name && await mutate("category",{name})) {
      setCategory("");
      setShowCategoryForm(false);
    }
  }
  async function createShelf(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = shelfName.trim();
    if (!supabase || !me || !personalShelves || !name || busy) return;
    setBusy(true);
    setShelfMessage("");
    try {
      const sortOrder = personalShelves.reduce((next,shelf)=>Math.max(next,shelf.sort_order+1),0);
      const {data,error} = await supabase.from("user_shelves")
        .insert({user_id:me,name,sort_order:sortOrder}).select("id,name,sort_order").single();
      if (error) throw error;
      setPersonalShelves(current=>[...(current ?? []),data as PersonalShelf]);
      setShelfName("");
      setShowShelfForm(false);
    } catch {
      setShelfMessage("棚を作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function changeShelfItem(shelfId:string,workId:string,remove=false) {
    if (!supabase || busy || !personalShelves?.some(shelf=>shelf.id===shelfId)) return;
    const sameItem = (item:PersonalShelfItem)=>item.shelf_id===shelfId && item.book_id===workId;
    const alreadyOnShelf = personalShelfItems.some(sameItem);
    if (remove ? !alreadyOnShelf : alreadyOnShelf) return;
    setBusy(true);
    setShelfMessage("");
    try {
      const table = supabase.from("user_shelf_items");
      if (remove) {
        const {error} = await table.delete().eq("shelf_id",shelfId).eq("book_id",workId);
        if (error) throw error;
        setPersonalShelfItems(current=>current.filter(item=>!sameItem(item)));
      } else {
        const sortOrder = personalShelfItems.reduce((next,item)=>
          item.shelf_id===shelfId ? Math.max(next,item.sort_order+1) : next,0);
        const item = {shelf_id:shelfId,book_id:workId,sort_order:sortOrder};
        const {error} = await table.insert(item);
        if (error?.code==="23505") {
          await load();
        } else {
          if (error) throw error;
          setPersonalShelfItems(current=>[...current,item]);
        }
      }
    } catch {
      setShelfMessage(remove?"作品を棚から外せませんでした。":"作品を棚に追加できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  function shelfSelect(work:Work) {
    const options = personalShelves?.filter(shelf=>
      !personalShelfItems.some(item=>item.shelf_id===shelf.id && item.book_id===work.id));
    if (!options?.length) return null;
    return <select value="" disabled={busy} aria-label={`${work.title||"作品"}を棚に追加`}
      onChange={event=>{if (event.target.value) void changeShelfItem(event.target.value,work.id);}}
      className="mt-2 w-full min-w-0 rounded-lg border px-2 py-1 text-xs">
      <option value="">棚に追加…</option>
      {options.map(shelf=><option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
    </select>;
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
  function organizeWork(work:Work) {
    return <>
      {categorySelect("work",work.id)}
      {shelfSelect(work)}
    </>;
  }
  function workActions(work:Work) {
    const starred = Boolean(data?.stars.some(item=>item.work_id===work.id));
    const state = data?.reading.find(item=>item.work_id===work.id)?.state ?? "";
    return <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} aria-pressed={starred}
          aria-label={`${work.title||"作品"}のお気に入り`}
          onClick={()=>void mutate("star",{workId:work.id},starred?"DELETE":"POST")}
          className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50">{starred?"★":"☆"}</button>
        <select aria-label={`${work.title||"作品"}の読書状態`} disabled={busy} value={state}
          onChange={e=>void mutate("reading",{workId:work.id,state:e.target.value},e.target.value?"POST":"DELETE")}
          className="min-w-0 rounded-lg border px-1 py-1 text-xs">
          <option value="">未設定</option>
          <option value="to_read">あとで読む</option>
          <option value="reading">読書中</option>
          <option value="read">読了</option>
        </select>
      </div>
      {organizeWork(work)}
    </>;
  }
  function matchesWorkCategory(workId:string) {
    return !categoryFilter || data?.categoryItems.some(item=>item.category_id===categoryFilter && item.target_kind==="work" && item.target_id===workId);
  }
  const visibleWorks = works.filter(work=>work.owner===me && matchesWorkCategory(work.id));
  const visibleAuthors = categoryFilter ? authors.filter(a=>data?.categoryItems.some(i=>i.category_id===categoryFilter && i.target_kind==="author" && i.target_id===a.user_id)) : authors;
  const worksById = new Map(works.map(work=>[work.id,work]));
  const authorsById = new Map(workAuthors.map(author=>[author.user_id,author]));
  function readingItems(entries: {id:string;date:string|null}[], newestFirst=true):ReadingWork[] {
    const seen = new Set<string>();
    const ordered = newestFirst ? [...entries].sort((a,b)=>(b.date ?? "").localeCompare(a.date ?? "")) : entries;
    return ordered.flatMap(({id,date})=>{
      if (seen.has(id)) return [];
      seen.add(id);
      const work=worksById.get(id);
      if (!work || !matchesWorkCategory(id)) return [];
      const author=authorsById.get(work.owner);
      return [{work,date,author:author?.display_name || author?.username || ""}];
    });
  }
  const later = readingItems([
    ...activity.filter(row=>row.type!=="viewed").map(row=>({id:row.book_id,date:row.created_at})),
    ...(data?.reading ?? []).filter(row=>row.state==="to_read" || row.state==="reading").map(row=>({id:row.work_id,date:row.updated_at})),
  ]);
  const recent = readingItems(activity.filter(row=>row.type==="viewed").map(row=>({id:row.book_id,date:row.created_at})));
  const favorites = readingItems((data?.stars ?? []).map(row=>({id:row.work_id,date:row.created_at})));
  const finished = readingItems((data?.reading ?? []).filter(row=>row.state==="read").map(row=>({id:row.work_id,date:row.updated_at})));
  return <main className="min-h-screen bg-white">
    <div className="mx-auto max-w-4xl px-4 py-6">
      <MyAreaHeader title="書棚" area="library"
        navigation={<LibraryV2Menu active="shelf" />} />
      <div className="mt-6">
        <BookshelfAnnouncements />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="書棚の表示">
          {tabs.map(t=><button type="button" role="tab" aria-selected={tab===t.id} key={t.id} onClick={()=>setTab(t.id)}
            className={"rounded-full border px-3 py-2 text-sm "+(tab===t.id?"bg-neutral-900 text-white":"bg-white text-neutral-800")}>{t.name}</button>)}
        </div>
        {message && <p role="status" className="mt-5 text-sm text-neutral-600">{message}</p>}
        {shelfMessage && <p role="status" className="mt-3 text-sm text-neutral-600">{shelfMessage}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="library-category-filter" className="text-sm">カテゴリー</label>
          <select id="library-category-filter" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="rounded-lg border px-2 py-2 text-sm">
            <option value="">すべて</option>
            {data?.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" aria-expanded={showCategoryForm} aria-controls="library-create-category"
            onClick={()=>setShowCategoryForm(open=>!open)} className="rounded-lg border px-3 py-2 text-sm">＋ カテゴリーを作る</button>
        </div>
        <form id="library-create-category" hidden={!showCategoryForm} onSubmit={addCategory}>
          <div className="mt-3 flex gap-2">
            <input aria-label="新しいカテゴリー" value={category} onChange={e=>setCategory(e.target.value)} maxLength={80}
              placeholder="例：ZUMBA、文学" className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
            <button type="submit" disabled={busy || !data || !category.trim()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">作成</button>
          </div>
        </form>
        <section className="mt-6">
          {tab==="authors" ? <div className="grid gap-3 sm:grid-cols-2">{visibleAuthors.map(a=><div key={a.user_id} className="rounded-xl border border-neutral-200 p-4"><Link href={a.username?"/"+encodeURIComponent(a.username)+"/library":"#"} className="font-medium underline">{a.display_name||a.username||"作者"}</Link>{categorySelect("author",a.user_id)}</div>)}
            {!message && authors.length===0 && <p className="text-sm text-neutral-500">まだファン登録した作者はいません。</p>}</div>
          : tab==="history" ? <div className="space-y-4">
              {activityError && <p role="status" className="text-sm text-neutral-600">保存・閲覧の記録を読み込めませんでした。</p>}
              <ReadingShelfRow title="あとで読む" items={later} emptyMessage="「あとで読む」に追加した作品がここに並びます。" renderActions={organizeWork} />
              <ReadingShelfRow title="最近開いた作品" items={recent} emptyMessage="まだ開いた作品はありません。" showDate renderActions={organizeWork} />
              <ReadingShelfRow title="お気に入り" items={favorites} emptyMessage="お気に入りに追加した作品がここに並びます。" renderActions={workActions} />
              {finished.length>0 && <ReadingShelfRow title="読了" items={finished} emptyMessage="読了にした作品がここに並びます。" renderActions={workActions} />}
            </div>
          : tab==="shelves" ? <div className="space-y-4">
              <button type="button" disabled={!personalShelves} aria-expanded={showShelfForm} aria-controls="library-create-shelf"
                onClick={()=>setShowShelfForm(open=>!open)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">＋ 棚を作る</button>
              <form id="library-create-shelf" hidden={!showShelfForm} onSubmit={createShelf}>
                <div className="flex gap-2">
                  <input aria-label="棚の名前" value={shelfName} onChange={e=>setShelfName(e.target.value)} maxLength={80}
                    placeholder="例：旅の本" className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
                  <button type="submit" disabled={busy || !shelfName.trim()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">作成</button>
                </div>
              </form>
              {personalShelves?.length===0 && <p className="text-sm text-neutral-500">まだ自分の棚はありません。</p>}
              {personalShelves?.map(shelf=>{
                const entries = personalShelfItems.filter(item=>item.shelf_id===shelf.id).map(item=>({id:item.book_id,date:null}));
                return <ReadingShelfRow key={shelf.id} title={shelf.name} items={readingItems(entries,false)}
                  emptyMessage={categoryFilter?"このカテゴリーに該当する作品はありません。":"作品カードの「棚に追加…」から作品を並べられます。"}
                  renderActions={work=><>
                    {categorySelect("work",work.id)}
                    <button type="button" disabled={busy} aria-label={`${work.title||"作品"}を${shelf.name}から外す`}
                      onClick={()=>void changeShelfItem(shelf.id,work.id,true)} className="mt-2 text-xs underline disabled:opacity-50">棚から外す</button>
                  </>} />;
              })}
            </div>
          : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{visibleWorks.map(w=><div key={w.id} className="min-w-0 rounded-xl border border-neutral-200 p-3"><Link href={"/p/"+w.id} className="block">
              <div className="mb-2 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-neutral-100">{coverOf(w) ? <img src={coverOf(w)} alt="" loading="lazy" className="h-full w-full object-cover"/> : <span className="px-3 text-center text-xs text-neutral-500">表紙画像なし</span>}</div>
              <span className="break-words text-sm font-medium">{w.title||"無題の作品"}</span></Link>{workActions(w)}</div>)}
            {!message && visibleWorks.length===0 && <p className="text-sm text-neutral-500">該当する作品はありません。</p>}</div>}
        </section>
      </div>
    </div>
  </main>;
}
