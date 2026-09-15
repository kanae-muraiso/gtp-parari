"use client";

import { useEffect, useMemo, useState } from "react";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
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

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
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

    setItems((announcements ?? []) as Announcement[]);
    setStates((stateRows ?? []) as StateRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const stateById = useMemo(
    () => new Map(states.map((row) => [row.announcement_id, row])),
    [states],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !stateById.get(item.id)?.dismissed_at),
    [items, stateById],
  );

  async function openAnnouncement(item: Announcement) {
    const nextOpenId = openId === item.id ? null : item.id;
    setOpenId(nextOpenId);

    if (nextOpenId === null || stateById.get(item.id)?.read_at || !supabase) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("parari_announcement_states")
      .upsert(
        {
          announcement_id: item.id,
          user_id: user.id,
          read_at: now,
          updated_at: now,
        },
        { onConflict: "announcement_id,user_id" },
      );

    if (!error) {
      setStates((current) => {
        const others = current.filter(
          (row) => row.announcement_id !== item.id,
        );
        return [
          ...others,
          {
            announcement_id: item.id,
            read_at: now,
            dismissed_at: null,
          },
        ];
      });
    }
  }

  async function dismiss(item: Announcement) {
    if (!supabase) return;
    if (!window.confirm("このお知らせを削除しますか？")) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const previous = stateById.get(item.id);

    const { error } = await supabase
      .from("parari_announcement_states")
      .upsert(
        {
          announcement_id: item.id,
          user_id: user.id,
          read_at: previous?.read_at ?? now,
          dismissed_at: now,
          updated_at: now,
        },
        { onConflict: "announcement_id,user_id" },
      );

    if (error) {
      setMessage(`削除できませんでした: ${error.message}`);
      return;
    }

    setStates((current) => {
      const others = current.filter(
        (row) => row.announcement_id !== item.id,
      );
      return [
        ...others,
        {
          announcement_id: item.id,
          read_at: previous?.read_at ?? now,
          dismissed_at: now,
        },
      ];
    });
    if (openId === item.id) setOpenId(null);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="お知らせ" />

        <div className="mt-6">
          <MyPrimaryTabs active="bookshelf" />
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <div className="mb-5">
            <div className="text-sm font-bold text-neutral-950">
              PARARIからのお知らせ
            </div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              読んでも残ります。不要になったものだけ、自分で削除できます。
            </p>
          </div>

          {message ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {message}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
              読み込み中…
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
              現在お知らせはありません。
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const state = stateById.get(item.id);
                const unread = !state?.read_at;
                const open = openId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-neutral-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => void openAnnouncement(item)}
                      className="w-full px-5 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {unread ? (
                              <span className="h-2 w-2 rounded-full bg-neutral-950" />
                            ) : null}
                            {item.is_important ? (
                              <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-bold text-white">
                                重要
                              </span>
                            ) : null}
                            <span className="text-sm font-bold text-neutral-950">
                              {item.title}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-400">
                            {formatDate(item.published_at)}
                          </div>
                        </div>
                        <span className="text-sm text-neutral-400">
                          {open ? "−" : "+"}
                        </span>
                      </div>
                    </button>

                    {open ? (
                      <div className="border-t border-neutral-100 px-5 pb-5 pt-4">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                          {item.body}
                        </p>
                        <div className="mt-5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void dismiss(item)}
                            className="text-xs font-bold text-neutral-400 transition hover:text-rose-600"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
