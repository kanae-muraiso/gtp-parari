"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";

type Author = { user_id: string; username: string; display_name: string | null };
type Work = { id: string; title: string | null; owner: string };
type WorkAuthor = Omit<Author, "username"> & { username: string | null };
type FoundWork = Work & { author?: WorkAuthor };
const workLimit = 30;

function WorkSearchPanel() {
  const [title, setTitle] = useState("");
  const [works, setWorks] = useState<FoundWork[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = title.trim();
    if (!query || pending) return;
    if (!supabase) {
      setMessage("接続設定がありません。");
      return;
    }

    setPending(true);
    setWorks([]);
    setMessage("");
    try {
      // Treat punctuation as part of the title, including %, _ and *.
      const pattern = query.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
      const { data, error } = await supabase.from("parari_books")
        .select("id,title,owner")
        .eq("visibility", "public")
        .eq("show_in_profile_works", true)
        .eq("is_deleted", false)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .filter("title", "imatch", pattern)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id")
        .limit(workLimit + 1);
      if (error) throw error;

      const matches: Work[] = (data ?? []).slice(0, workLimit);
      if (!matches.length) {
        setMessage("該当する公開作品はありません。");
        return;
      }

      const { data: profiles } = await supabase.from("profiles")
        .select("user_id,username,display_name")
        .in("user_id", [...new Set(matches.map(work => work.owner))]);
      const authorsById = new Map((profiles ?? []).map(author => [author.user_id, author]));
      setWorks(matches.map(work => ({ ...work, author: authorsById.get(work.owner) })));
      if ((data?.length ?? 0) > workLimit) {
        setMessage("先頭の30件を表示しています。検索語を変えて絞り込んでください。");
      }
    } catch {
      setMessage("作品を検索できませんでした。");
    } finally {
      setPending(false);
    }
  }

  return <section aria-labelledby="work-search-heading" className="rounded-2xl border border-neutral-200 p-4 sm:p-6">
    <h2 id="work-search-heading" className="text-lg font-semibold">作品を探す</h2>
    <p className="mt-1 text-sm text-neutral-500">作品名の一部から公開作品を探せます。</p>
    <form onSubmit={lookup} className="mt-4 flex gap-2">
      <input type="search" aria-label="作品名" value={title} onChange={e => setTitle(e.target.value)}
        maxLength={120} required placeholder="作品名"
        className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
      <button type="submit" disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">検索</button>
    </form>
    {(pending || message) && <p role="status" className="mt-3 text-sm text-neutral-600">
      {pending ? "作品を検索しています…" : message}
    </p>}
    {works.length > 0 && <ul aria-label="作品の検索結果" className="mt-4 space-y-2">
      {works.map(({ id, title, author }) => <li key={id}>
        <Link href={"/p/" + id} className="block rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50">
          <div className="break-words font-medium">{title || "無題の作品"}</div>
          {author && <div className="break-words text-xs text-neutral-600">
            {author.display_name || author.username}{author.display_name && author.username ? " · @" + author.username : ""}
          </div>}
        </Link>
      </li>)}
    </ul>}
  </section>;
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [name, setName] = useState("");
  const [result, setResult] = useState<Author | null>(null);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [directoryError, setDirectoryError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const {data,error} = await supabase.from("profiles")
        .select("user_id,username,display_name")
        .eq("author_directory_opt_in",true)
        .not("username","is",null).order("username").limit(100);
      if (!active) return;
      if (error) setDirectoryError(true);
      else setAuthors((data ?? []).filter(x => x.username) as Author[]);
    }
    void load();
    return () => { active = false; };
  }, []);
  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearched(false); setResult(null);
    if (!supabase || !name.trim()) return;
    const {data,error} = await supabase.from("profiles")
      .select("user_id,username,display_name")
      .eq("username",name.trim()).maybeSingle();
    setMessage(error ? "検索に失敗しました。" : "");
    setResult((data as Author | null) ?? null);
    setSearched(true);
  }
  function card(a: Author) {
    return <Link key={a.user_id} href={`/${encodeURIComponent(a.username)}/library`}
      className="block rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
      <div className="font-medium">{a.display_name || a.username}</div>
      <div className="text-xs text-neutral-500">@{a.username}</div>
    </Link>;
  }
  return <main className="min-h-screen bg-white">
    <div className="mx-auto max-w-4xl px-4 py-6">
      <MyAreaHeader title="作品・作者を探す" area="library" />
      <LibraryV2Menu active="authors" />
      <div className="mt-6 space-y-4">
        <WorkSearchPanel />
        <section aria-labelledby="author-search-heading" className="rounded-2xl border border-neutral-200 p-4 sm:p-6">
          <h2 id="author-search-heading" className="text-lg font-semibold">作者を探す</h2>
          <form onSubmit={lookup} className="mt-4 flex gap-2">
            <input type="search" aria-label="ユーザーネーム" value={name} onChange={e => setName(e.target.value)}
              maxLength={80} required placeholder="ユーザーネーム（完全一致）"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white" type="submit">検索</button>
          </form>
          {message && <p role="status" className="mt-3 text-sm">{message}</p>}
          {searched && !message && <div className="mt-5">
            <h3 className="mb-2 font-semibold">検索結果</h3>
            {result ? card(result) : <p role="status" className="text-sm text-neutral-500">該当する作者はいません。</p>}
          </div>}
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <h3 className="font-semibold">作者図鑑</h3>
            <p className="mt-1 text-sm text-neutral-500">掲載を許可した作者のみ表示します。</p>
            {directoryError && <p role="status" className="mt-2 text-sm">作者図鑑を読み込めませんでした。</p>}
            {authors.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{authors.map(card)}</div>}
          </div>
        </section>
      </div>
    </div>
  </main>;
}
