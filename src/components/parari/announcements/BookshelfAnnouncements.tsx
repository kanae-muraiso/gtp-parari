"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  body: string;
  is_important: boolean;
  published_at: string | null;
};

type StateRow = {
  announcement_id: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export default function BookshelfAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        if (mounted) setLoading(false);
        return;
      }

      const [{ data: announcements }, { data: stateRows }] = await Promise.all([
        supabase
          .from("parari_announcements")
          .select("id,title,body,is_important,published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false }),
        supabase
          .from("parari_announcement_states")
          .select("announcement_id,read_at,dismissed_at")
          .eq("user_id", user.id),
      ]);

      if (!mounted) return;
      setItems((announcements ?? []) as Announcement[]);
      setStates((stateRows ?? []) as StateRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;

  const stateById = new Map(states.map((row) => [row.announcement_id, row]));
  const visible = items.filter(
    (item) => !stateById.get(item.id)?.dismissed_at,
  );
  const unread = visible.filter((item) => !stateById.get(item.id)?.read_at);
  const latestUnread = unread[0] ?? null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-4 px-1">
        <Link
          href="/my/announcements"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 transition hover:text-neutral-950"
        >
          <span>PARARIからのお知らせ</span>
          {unread.length > 0 ? (
            <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] text-white">
              {unread.length}
            </span>
          ) : null}
          <span className="text-neutral-400">›</span>
        </Link>
      </div>

      {latestUnread ? (
        <Link
          href="/my/announcements"
          className="mt-3 block rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:bg-neutral-50"
        >
          <div className="flex items-center gap-2">
            {latestUnread.is_important ? (
              <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-bold text-white">
                重要
              </span>
            ) : null}
            <div className="text-sm font-bold text-neutral-950">
              {latestUnread.title}
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-6 text-neutral-500">
            {latestUnread.body}
          </p>
        </Link>
      ) : null}
    </section>
  );
}
