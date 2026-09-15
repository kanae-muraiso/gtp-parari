"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  is_important: boolean;
  published_at: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ParariAnnouncementsAdmin() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabase) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("parari_announcements")
      .select("id,title,body,status,is_important,published_at,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`お知らせを読み込めませんでした: ${error.message}`);
      setItems([]);
    } else {
      setItems((data ?? []) as Announcement[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setImportant(false);
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setImportant(item.is_important);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(status: "draft" | "published") {
    if (!supabase || saving) return;
    if (!title.trim() || !body.trim()) {
      setMessage("タイトルと本文を入力してください。");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("ログイン状態を確認できませんでした。");
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      title: title.trim(),
      body: body.trim(),
      is_important: important,
      status,
      published_at: status === "published" ? now : null,
      updated_at: now,
    };

    const result = editingId
      ? await supabase
          .from("parari_announcements")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("parari_announcements").insert({
          ...payload,
          created_by: user.id,
        });

    if (result.error) {
      setMessage(`保存できませんでした: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setMessage(status === "published" ? "公開しました。" : "下書きを保存しました。");
    resetForm();
    await load();
    setSaving(false);
  }

  async function changeStatus(item: Announcement) {
    if (!supabase) return;

    const next = item.status === "published" ? "draft" : "published";
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("parari_announcements")
      .update({
        status: next,
        published_at: next === "published" ? now : null,
        updated_at: now,
      })
      .eq("id", item.id);

    if (error) {
      setMessage(`変更できませんでした: ${error.message}`);
      return;
    }

    await load();
  }

  async function remove(item: Announcement) {
    if (!supabase) return;
    if (!window.confirm(`「${item.title}」を削除しますか？`)) return;

    const { error } = await supabase
      .from("parari_announcements")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(`削除できませんでした: ${error.message}`);
      return;
    }

    if (editingId === item.id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-neutral-950">
              {editingId ? "お知らせを編集" : "新しいお知らせ"}
            </div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              公開すると、PARARI利用者の本棚に届きます。
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-950"
            >
              新規作成に戻る
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="タイトル"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
          />

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="本文"
            rows={7}
            className="w-full resize-y rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-neutral-500"
          />

          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-neutral-700">
            <input
              type="checkbox"
              checked={important}
              onChange={(event) => setImportant(event.target.checked)}
            />
            重要なお知らせ
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save("draft")}
              disabled={saving}
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 disabled:opacity-50"
            >
              下書き保存
            </button>
            <button
              type="button"
              onClick={() => void save("published")}
              disabled={saving}
              className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              今すぐ公開
            </button>
          </div>

          {message ? (
            <p className="text-xs leading-5 text-neutral-500">{message}</p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 text-xs font-bold tracking-[0.14em] text-neutral-400">
          お知らせ履歴
        </div>

        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            読み込み中…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            まだお知らせはありません。
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold text-neutral-950">
                        {item.title}
                      </div>
                      {item.is_important ? (
                        <span className="rounded-full bg-neutral-950 px-2 py-1 text-[10px] font-bold text-white">
                          重要
                        </span>
                      ) : null}
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600">
                        {item.status === "published" ? "公開中" : "下書き"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-neutral-600">
                      {item.body}
                    </p>
                    <p className="mt-3 text-[11px] text-neutral-400">
                      公開: {formatDate(item.published_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-xs font-bold text-neutral-600 hover:text-neutral-950"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => void changeStatus(item)}
                      className="text-xs font-bold text-neutral-600 hover:text-neutral-950"
                    >
                      {item.status === "published" ? "非公開" : "公開"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      className="text-xs font-bold text-rose-500 hover:text-rose-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
