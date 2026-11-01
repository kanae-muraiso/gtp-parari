"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";

type Author = { user_id: string; username: string; display_name: string | null };
export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [name, setName] = useState("");
  const [result, setResult] = useState<Author | null>(null);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const {data,error} = await supabase.from("profiles")
        .select("user_id,username,display_name")
        .eq("author_directory_opt_in",true)
        .not("username","is",null).order("username").limit(100);
      if (!active) return;
      if (error) setMessage("作者図鑑を読み込めませんでした。");
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
      <MyAreaHeader title="作者を探す" area="library" navigation={<MyPrimaryTabs active="bookshelf" embedded />} />
      <h1 className="mt-6 text-xl font-bold">作者を探す</h1>
      <form onSubmit={lookup} className="mt-4 flex gap-2">
        <input aria-label="ユーザーネーム" value={name} onChange={e => setName(e.target.value)}
          maxLength={80} placeholder="ユーザーネーム（完全一致）"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white" type="submit">検索</button>
      </form>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      {searched && <section className="mt-5">
        <h2 className="mb-2 font-semibold">検索結果</h2>
        {result ? card(result) : <p className="text-sm text-neutral-500">該当する作者はいません。</p>}
      </section>}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">作者図鑑</h2>
        <p className="mt-1 text-sm text-neutral-500">掲載を許可した作者のみ表示します。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{authors.map(card)}</div>
      </section>
    </div>
  </main>;
}
