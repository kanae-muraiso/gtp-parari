"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import { supabase } from "@/lib/supabaseClient";

type DictionaryRow = {
  id: number;
  word: string;
  lemma: string;
  pos: string;
  form_type: string;
  sense_id: string;
  meaning_ja: string;
  eiken_level: string | null;
  eiken_levels: string[];
  parari_level: string | null;
  importance: number;
  entry_kind: string;
  source: string;
  category: string | null;
  note: string | null;
  note2: string | null;
  active: boolean;
  updated_at: string;
};

const EMPTY_ROW: Omit<DictionaryRow, "id" | "updated_at"> = {
  word: "",
  lemma: "",
  pos: "unknown",
  form_type: "base",
  sense_id: "1",
  meaning_ja: "",
  eiken_level: null,
  eiken_levels: [],
  parari_level: null,
  importance: 1,
  entry_kind: "word",
  source: "manual",
  category: "manual",
  note: null,
  note2: null,
  active: true,
};

async function authHeaders() {
  if (!supabase) throw new Error("Supabaseに接続できません。");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインしてください。");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export default function EnglishDictionaryAdminPage() {
  const { isSuperuser, loading: accessLoading } = useParariStaff();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<DictionaryRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DictionaryRow | null>(null);
  const [draft, setDraft] = useState<DictionaryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  const totalPages = Math.max(1, Math.ceil(count / 50));

  async function load(nextPage = page, nextQuery = query) {
    setLoading(true);
    setMessage("");
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({
        q: nextQuery.trim(),
        page: String(nextPage),
        limit: "50",
      });
      const response = await fetch(`/api/internal/english-dictionary?${params}`, {
        headers,
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "辞書を取得できませんでした。");
      setRows(json.rows ?? []);
      setCount(json.count ?? 0);
      setPage(json.page ?? nextPage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "辞書を取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accessLoading && isSuperuser) void load(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, isSuperuser]);

  function openRow(row: DictionaryRow) {
    setSelected(row);
    setDraft({ ...row, eiken_levels: [...(row.eiken_levels ?? [])] });
    setCreating(false);
    setMessage("");
  }

  function startCreate() {
    const now = new Date().toISOString();
    const row = { id: 0, updated_at: now, ...EMPTY_ROW } as DictionaryRow;
    setSelected(null);
    setDraft(row);
    setCreating(true);
    setMessage("");
  }

  async function save() {
    if (!draft) return;
    setLoading(true);
    setMessage("");

    try {
      const headers = await authHeaders();
      const body = creating
        ? { entry: draft }
        : { id: draft.id, patch: draft };
      const response = await fetch("/api/internal/english-dictionary", {
        method: creating ? "POST" : "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "保存できませんでした。");
      setDraft(json.row);
      setSelected(json.row);
      setCreating(false);
      setMessage("保存しました。");
      await load(page, query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void load(1, query);
  }

  if (accessLoading) return <main className="min-h-screen bg-neutral-50" />;

  if (!isSuperuser) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-lg font-bold text-neutral-950">アクセスできません</div>
          <p className="mt-2 text-sm text-neutral-500">この画面はSUPERUSER専用です。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <MyAreaHeader title="英語辞書" area="operations" />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.15em] text-neutral-400">DICTIONARY SSOT</div>
            <p className="mt-1 text-xs text-neutral-500">
              {count.toLocaleString()}件。変化形も1項目として閲覧・編集できます。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
            >
              ＋ 単語を追加
            </button>
            <Link
              href="/my/operations"
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
            >
              OPERATIONSへ戻る
            </Link>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-6 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="word / lemma / 日本語訳を検索"
            className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            className="rounded-2xl bg-neutral-900 px-5 py-3 text-xs font-bold text-white"
          >
            検索
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">WORD</th>
                    <th className="px-3 py-3">LEMMA</th>
                    <th className="px-3 py-3">FORM</th>
                    <th className="px-3 py-3">POS</th>
                    <th className="px-3 py-3">英検</th>
                    <th className="px-4 py-3">意味</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openRow(row)}
                      className={[
                        "cursor-pointer border-t border-neutral-100 hover:bg-amber-50/40",
                        selected?.id === row.id ? "bg-amber-50" : "",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 font-bold text-neutral-900">{row.word}</td>
                      <td className="px-3 py-3 text-neutral-600">{row.lemma}</td>
                      <td className="px-3 py-3 text-neutral-500">{row.form_type}</td>
                      <td className="px-3 py-3 text-neutral-500">{row.pos}</td>
                      <td className="px-3 py-3 text-neutral-500">{row.eiken_level || "—"}</td>
                      <td className="max-w-[340px] truncate px-4 py-3 text-neutral-700">{row.meaning_ja}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void load(page - 1, query)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 disabled:opacity-30"
              >
                前へ
              </button>
              <span>{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void load(page + 1, query)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 disabled:opacity-30"
              >
                次へ
              </button>
            </div>
          </section>

          <aside className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            {draft ? (
              <DictionaryEditor row={draft} onChange={setDraft} onSave={() => void save()} saving={loading} />
            ) : (
              <div className="py-16 text-center text-sm text-neutral-400">
                左の単語を選ぶと編集できます。
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function DictionaryEditor({
  row,
  onChange,
  onSave,
  saving,
}: {
  row: DictionaryRow;
  onChange: (next: DictionaryRow) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const field = (key: keyof DictionaryRow, label: string) => (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-neutral-400">{label}</span>
      <input
        value={String(row[key] ?? "")}
        onChange={(event) => onChange({ ...row, [key]: event.target.value })}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-bold text-neutral-950">{row.id ? "辞書項目を編集" : "単語を追加"}</div>
        <div className="mt-1 text-[10px] text-neutral-400">ID {row.id || "NEW"}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field("word", "WORD")}
        {field("lemma", "LEMMA")}
        {field("pos", "POS")}
        {field("form_type", "FORM TYPE")}
        {field("sense_id", "SENSE ID")}
        {field("eiken_level", "英検級")}
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-neutral-400">日本語訳</span>
        <textarea
          value={row.meaning_ja}
          onChange={(event) => onChange({ ...row, meaning_ja: event.target.value })}
          rows={4}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm leading-6 outline-none focus:border-neutral-400"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-neutral-400">英検出現級（カンマ区切り）</span>
        <input
          value={(row.eiken_levels ?? []).join(", ")}
          onChange={(event) =>
            onChange({
              ...row,
              eiken_levels: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
            })
          }
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {field("entry_kind", "ENTRY KIND")}
        {field("source", "SOURCE")}
        {field("category", "CATEGORY")}
      </div>

      <label className="flex items-center gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={row.active}
          onChange={(event) => onChange({ ...row, active: event.target.checked })}
        />
        有効
      </label>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full rounded-2xl bg-neutral-950 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
