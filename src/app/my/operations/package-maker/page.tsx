"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import {
  createDefaultWriterDraft,
  normalizeWriterDraft,
  WRITER_IMPLEMENTATION,
  WRITER_KINDS,
  WRITER_PARTS,
  WRITER_SURFACES,
  WRITER_TIERS,
  type WriterKind,
  type WriterPart,
  type WriterPackageDraft,
  type WriterSurface,
  type WriterTier,
} from "@/lib/parari/app-maker/writersCatalog";

const STORAGE_KEY = "parari:app-maker:writers:v1";
type KindFilter = "all" | WriterKind;
const filters: { key: KindFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "panel", label: "作品パネル" },
  { key: "feature", label: "制作・運営" },
  { key: "connection", label: "外部接続" },
];

function statusClasses(status: WriterPart["implementation"]): string {
  return status === "ready"
    ? "bg-emerald-50 text-emerald-800"
    : status === "partial"
      ? "bg-amber-50 text-amber-800"
      : "bg-neutral-100 text-neutral-500";
}

function selectedBySurface(packageDraft: WriterPackageDraft["packages"][WriterTier], surface: WriterSurface) {
  return WRITER_PARTS.filter((part) =>
    packageDraft.parts.includes(part.id) &&
    (packageDraft.placements[part.id] ?? []).includes(surface),
  );
}

export default function WriterPackageMakerPage() {
  const { isSuperuser, loading: accessLoading } = useParariStaff();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<WriterPackageDraft>(createDefaultWriterDraft);
  const [tier, setTier] = useState<WriterTier>("A");
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [message, setMessage] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (accessLoading || !isSuperuser) return;
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value) setDraft(normalizeWriterDraft(JSON.parse(value)));
    } catch {
      setMessage("保存済みの構成を読み込めませんでした。初期構成で表示しています。");
    }
    setReady(true);
  }, [accessLoading, isSuperuser]);

  useEffect(() => {
    if (!ready || !isSuperuser) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setMessage("ブラウザーへの自動保存に失敗しました。JSONとして書き出してください。");
    }
  }, [draft, ready, isSuperuser]);

  const current = draft.packages[tier];
  const filteredParts = useMemo(() => WRITER_PARTS.filter((part) => {
    if (kind !== "all" && part.kind !== kind) return false;
    if (selectedOnly && !current.parts.includes(part.id)) return false;
    const search = query.trim().toLowerCase();
    return !search || [part.id, part.label, part.description].some((value) => value.toLowerCase().includes(search));
  }), [kind, selectedOnly, current.parts, query]);
  const selectedCount = current.parts.length;
  const plannedCount = WRITER_PARTS.filter((part) => part.implementation !== "ready" && current.parts.includes(part.id)).length;

  function updatePackage(update: (previous: WriterPackageDraft["packages"][WriterTier]) => WriterPackageDraft["packages"][WriterTier]) {
    setDraft((previous) => ({
      ...previous,
      packages: { ...previous.packages, [tier]: update(previous.packages[tier]) },
    }));
    setMessage("");
  }

  function togglePart(part: WriterPart) {
    if (part.required) return;
    updatePackage((previous) => {
      const exists = previous.parts.includes(part.id);
      const parts = exists
        ? previous.parts.filter((id) => id !== part.id)
        : [...previous.parts, part.id];
      const placements = { ...previous.placements };
      if (exists) delete placements[part.id];
      else placements[part.id] = [...part.surfaces];
      return { ...previous, parts, placements };
    });
  }

  function toggleSurface(part: WriterPart, surface: WriterSurface) {
    updatePackage((previous) => {
      if (!previous.parts.includes(part.id)) return previous;
      const existing = previous.placements[part.id] ?? [];
      const next = existing.includes(surface)
        ? existing.filter((item) => item !== surface)
        : [...existing, surface];
      return { ...previous, placements: { ...previous.placements, [part.id]: next } };
    });
  }

  function resetTier() {
    if (!window.confirm(`${tier} の構成を初期状態に戻しますか？`)) return;
    const initial = createDefaultWriterDraft();
    updatePackage(() => initial.packages[tier]);
    setMessage(`WRITERS ${tier} を初期状態に戻しました。`);
  }

  function resetAll() {
    if (!window.confirm("WRITERS A・B・C をすべて初期状態に戻しますか？")) return;
    setDraft(createDefaultWriterDraft());
    setMessage("3つのパッケージを初期状態に戻しました。");
  }

  function download() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "parari-writers-package-draft.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("構成ファイルを書き出しました。別の端末へ移す際に利用できます。");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setMessage("構成ファイルは1MB以下にしてください。");
      return;
    }
    try {
      const value = JSON.parse(await file.text()) as { version?: unknown; packages?: unknown };
      if (value.version !== 1 || !value.packages || typeof value.packages !== "object") {
        throw new Error("このファイルはWRITERS構成v1ではありません。");
      }
      if (!window.confirm("現在のWRITERS A・B・C構成を、読み込んだ内容で置き換えますか？")) return;
      setDraft(normalizeWriterDraft(value));
      setMessage("構成を読み込みました。このブラウザーに自動保存されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSONファイルを読み込めませんでした。");
    }
  }

  if (accessLoading || (isSuperuser && !ready)) {
    return <main className="mx-auto max-w-5xl px-5 py-16 text-sm text-neutral-500">パッケージの構成を読み込んでいます…</main>;
  }
  if (!isSuperuser) {
    return <main className="mx-auto max-w-3xl px-5 py-16 text-center"><h1 className="text-xl font-bold">アクセスできません</h1><p className="mt-3 text-sm text-neutral-500">この画面はSUPERUSER専用です。</p></main>;
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-20">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="PACKAGE MAKER" area="operations" />
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.15em] text-neutral-500">APP MAKER / WRITERS</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-950">ライターズ・パッケージメーカー</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-600">パネル・機能・外部接続を選び、どの画面に置くかを決めます。選択すると構成プレビューが変わります。</p>
          </div>
          <Link href="/my/operations" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">OPERATIONSへ戻る</Link>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <strong>構成設計モード：</strong> 編集内容はこのブラウザーに自動保存されます。契約料金、サーバー側権限、実際の作品編集メニューにはまだ反映しません。初期設定は現行の権限を保証するものではありません。
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {WRITER_TIERS.map((item) => (
            <button key={item} type="button" onClick={() => setTier(item)}
              className={`rounded-xl px-6 py-3 text-sm font-bold transition ${tier === item ? "bg-neutral-950 text-white shadow-sm" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"}`}
              aria-pressed={tier === item}>WRITERS {item} <span className="ml-1 text-[10px] opacity-60">({draft.packages[item].parts.length})</span></button>
          ))}
          <span className="ml-auto text-xs text-neutral-400">自動保存（このブラウザーのみ）</span>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-neutral-600">商品名
              <input value={current.name} maxLength={80} onChange={(event) => updatePackage((previous) => ({ ...previous, name: event.target.value }))}
                className="mt-1 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-400"/>
            </label>
            <label className="text-xs font-bold text-neutral-600">パッケージの目的
              <input value={current.concept} maxLength={240} onChange={(event) => updatePackage((previous) => ({ ...previous, concept: event.target.value }))}
                className="mt-1 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-400"/>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-neutral-100 px-3 py-1">選択済み {selectedCount} / {WRITER_PARTS.length}</span>
            {plannedCount > 0 ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">一部実装・将来候補 {plannedCount}件</span> : null}
            <span className="rounded-full bg-neutral-100 px-3 py-1">必須部品は解除不可</span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.8fr)]">
          <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">構成パーツを選ぶ</h2>
              <button type="button" onClick={resetTier} className="text-xs font-semibold text-neutral-500 underline hover:text-neutral-950">{tier}を初期状態へ戻す</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button key={filter.key} type="button" aria-pressed={filter.key === kind} onClick={() => setKind(filter.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind === filter.key ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>{filter.label}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input aria-label="構成パーツ検索" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="パーツを検索"
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"/>
              <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/>選択中のみ</label>
            </div>
            <div className="mt-4 space-y-3">
              {filteredParts.map((part) => {
                const checked = current.parts.includes(part.id);
                const placement = current.placements[part.id] ?? [];
                return (
                  <div key={part.id} className={`rounded-xl border p-4 ${checked ? "border-sky-200 bg-sky-50/30" : "border-neutral-200 bg-white"}`}>
                    <div className="flex items-start gap-3">
                      <input id={`part-${part.id}`} type="checkbox" checked={checked} disabled={part.required}
                        onChange={() => togglePart(part)} className="mt-1 h-4 w-4 accent-neutral-950"/>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`part-${part.id}`} className="cursor-pointer text-sm font-bold text-neutral-900">{part.label}</label>
                        <span className="ml-2 font-mono text-[10px] text-neutral-400">{part.id}</span>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">{part.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">{WRITER_KINDS[part.kind]}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusClasses(part.implementation)}`}>{WRITER_IMPLEMENTATION[part.implementation]}</span>
                          {part.required ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">必須</span> : null}
                        </div>
                      </div>
                    </div>
                    {checked ? (
                      <div className="mt-3 border-t border-neutral-200/70 pt-3">
                        <p className="mb-2 text-[11px] font-bold text-neutral-500">表示する場所（複数選択可）</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {part.surfaces.map((surface) => (
                            <label key={surface} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
                              <input type="checkbox" checked={placement.includes(surface)} onChange={() => toggleSurface(part, surface)}/>
                              {WRITER_SURFACES[surface]}
                            </label>
                          ))}
                        </div>
                        {placement.length === 0 ? <p className="mt-2 text-[11px] text-amber-700">選択済みですが表示場所がありません。</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {filteredParts.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-400">一致するパーツがありません。</p> : null}
            </div>
          </section>

          <aside className="self-start rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 lg:sticky lg:top-5">
            <h2 className="text-base font-bold">構成プレビュー</h2>
            <p className="mt-1 text-xs text-neutral-500">{current.name}：{current.concept}</p>
            <div className="mt-4 space-y-4">
              {(Object.entries(WRITER_SURFACES) as [WriterSurface, string][]).map(([surface, label]) => {
                const parts = selectedBySurface(current, surface);
                return (
                  <div key={surface} className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-neutral-900">{label}</h3>
                      <span className="text-[10px] text-neutral-400">{parts.length}件</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {parts.length ? parts.map((part) => <span key={part.id} className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-700">{part.label}{part.implementation === "planned" ? "（予定）" : ""}</span>) :
                        <span className="text-[11px] text-neutral-400">表示項目なし</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <h3 className="text-xs font-bold text-neutral-800">3パッケージ比較</h3>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {WRITER_TIERS.map((item) => (
                  <button key={item} type="button" onClick={() => setTier(item)} className={`rounded-lg p-3 text-center ${tier === item ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                    <span className="block text-sm font-bold">{item}</span>
                    <span className="text-[10px] opacity-70">{draft.packages[item].parts.length}パーツ</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-bold">構成の保存・受け渡し</h2>
          <p className="mt-1 text-xs leading-6 text-neutral-500">変更は現在のブラウザーへ自動保存します。別の端末に移す場合や構成をレビューする場合はJSONとして書き出してください。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={download} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-xs font-bold text-white">JSONを書き出す</button>
            <button type="button" onClick={() => uploadRef.current?.click()} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-xs font-bold text-neutral-700">JSONを読み込む</button>
            <button type="button" onClick={resetAll} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-xs font-bold text-neutral-500">すべて初期状態に戻す</button>
            <input ref={uploadRef} className="hidden" type="file" accept=".json,application/json" onChange={(event) => void importFile(event)}/>
          </div>
          {message ? <p role="status" className="mt-3 text-xs text-neutral-700">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}
