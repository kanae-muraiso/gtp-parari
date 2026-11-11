"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { BookOutlineEntry } from "@/lib/parari/book/pageRefs";
import { deskOutline, groupDeskChapters, makeDesk, saveDeskLayout, type DeskPile } from "@/lib/parari/book/paperDesk";

const paperWidth = 210;
const paperHeight = 224;
const edgeHeight = 23;
const clipboardTop = 76;
const clipboardInset = 14;
const stackOffsets = [0, 5, -3, 8];
const paperAngles = [-5.5, 2.5, -2, 5, -3.5, 1.5, -4.5, 3.5, -1.5, 4.5, -2.5];

function paperAngle(id: string) {
  let index = 0;
  for (const character of id) {
    index = (index * 31 + character.charCodeAt(0)) % paperAngles.length;
  }
  return paperAngles[index];
}

const actionClass = "rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-stone-100 disabled:opacity-40";
const primaryClass = "rounded-full bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40";
const pileHeight = (pile: DeskPile) => paperHeight + Math.min(Math.max(0, pile.pages.length - 1), 3) * edgeHeight;

type Props = {
  storageKey: string;
  outline: BookOutlineEntry[];
  pages: ReadonlyMap<string, { title: string; excerpt: string }>;
  renderPage: (id: string) => ReactNode;
  onApply: (outline: BookOutlineEntry[]) => void;
  onClose: () => void;
};
type View = { x: number; y: number; scale: number };
type Drag = {
  pointer: number;
  x: number;
  y: number;
  pile?: number;
  page?: number;
};
type Motion = { x: number; y: number; target?: number; pile?: number; page?: number };

export function BookPaperDesk({ storageKey, outline, pages, renderPage, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const motionRef = useRef<Motion | null>(null);
  const nextKey = useRef(outline.length);
  const [base] = useState(() => JSON.stringify(outline));
  const [piles, setPiles] = useState(() => makeDesk(outline, storageKey));
  const [history, setHistory] = useState<DeskPile[][]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [motion, setMotion] = useState<Motion | null>(null);
  const [raisedPiles, setRaisedPiles] = useState<number[]>([]);
  const [chapterOrderOpen, setChapterOrderOpen] = useState(false);
  const [chapterDropKey, setChapterDropKey] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [spread, setSpread] = useState<number | null>(null);
  const spreadScrollTop = useRef(0);
  const restoreSpreadScroll = useCallback((element: HTMLDivElement | null) => {
    if (element) element.scrollTop = spreadScrollTop.current;
  }, []);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [chapterName, setChapterName] = useState<string | null>(null);
  const [renameKey, setRenameKey] = useState<number | null>(null);
  const [discard, setDiscard] = useState(false);
  const draft = useMemo(() => deskOutline(piles), [piles]);
  const structureChanged = useMemo(() => JSON.stringify(draft) !== base, [draft, base]);
  const stale = useMemo(() => JSON.stringify(outline) !== base, [outline, base]);
  const spreadPile = piles.find(pile => pile.key === spread);
  const pageNumbers = useMemo(() => new Map(piles.flatMap(pile => pile.pages).map((page, index) => [page.key, index + 1])), [piles]);
  const { opening, chapters } = useMemo(() => groupDeskChapters(piles), [piles]);
  const chapterNumbers = useMemo(() => new Map(chapters.map(({ key }, index) => [key, index + 1])), [chapters]);
  const layers = useMemo(() => new Map(raisedPiles.map((key, index) => [key, index + 1])), [raisedPiles]);
  const overlayOpen = chapterOrderOpen || discard || chapterName !== null || !!spreadPile || !!openPage;

  function fit() {
    if (!canvas.current || !piles.length) return;
    const { clientWidth, clientHeight } = canvas.current;
    const left = Math.min(...piles.map(pile => pile.x - (pile.chapter ? clipboardInset : 0))) - 24;
    const top = Math.min(...piles.map(pile => pile.y - (pile.chapter ? clipboardTop + 8 : 36))) - 12;
    const width = Math.max(...piles.map(pile => pile.x + (pile.chapter ? clipboardInset : 0))) + paperWidth + 24 - left;
    const height = Math.max(...piles.map(pile => pile.y + pileHeight(pile) + (pile.chapter ? clipboardInset : 0))) + 24 - top;
    const scale = Math.max(0.05, Math.min(1, clientWidth / width, clientHeight / height));
    setView({ x: (clientWidth - width * scale) / 2 - left * scale, y: (clientHeight - height * scale) / 2 - top * scale, scale });
  }

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    fit();
    return () => element?.close();
    // Fit once when the desk opens. Subsequent fitting is an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(next: DeskPile[]) {
    setHistory(current => [...current.slice(-39), piles]);
    setPiles(next);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setPiles(previous);
    setHistory(history.slice(0, -1));
    setSelected([]);
  }

  function closeDesk() {
    if (structureChanged && !discard) {
      setDiscard(true);
      return;
    }
    if (!stale && !structureChanged) saveDeskLayout(storageKey, outline, piles);
    onClose();
  }

  function apply() {
    if (stale) return;
    if (structureChanged) onApply(draft);
    saveDeskLayout(storageKey, draft, piles);
    onClose();
  }

  function select(key: number) {
    setSelected(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }

  function bundle(title?: string) {
    const members = new Set(selected);
    const firstIndex = piles.findIndex(pile => pile.pages.some(page => members.has(page.key)));
    if (firstIndex < 0) return;
    const first = piles[firstIndex];
    const collected = piles.flatMap(pile => pile.pages.filter(page => members.has(page.key)));
    const chapter = first.chapter;
    if (title && chapter && collected.length === first.pages.length &&
        first.pages.every(page => members.has(page.key))) {
      change(piles.map(pile => pile === first
        ? { ...pile, chapter: { ...chapter, title } } : pile));
      setSelected([]);
      setChapterName(null);
      return;
    }
    const keepFirst = first.chapter || first.pages.some(page => !members.has(page.key));
    const newPile: DeskPile = {
      key: nextKey.current++,
      pages: collected,
      x: first.x + (keepFirst ? 30 : 0),
      y: first.y + (keepFirst ? 42 : 0),
      chapter: title ? { kind: "chapter", id: crypto.randomUUID(), title } : undefined,
    };
    // Insert a new chapter after the first source's group, so unrelated PAGEs
    // between this point and the next chapter keep their previous chapter.
    const nextChapter = piles.findIndex((pile, index) => index > firstIndex && !!pile.chapter);
    const after = title ? (nextChapter < 0 ? piles.length - 1 : nextChapter - 1) : firstIndex;
    const next = piles.flatMap((pile, index) => {
      const remaining = { ...pile, pages: pile.pages.filter(page => !members.has(page.key)) };
      const kept = remaining.pages.length || remaining.chapter ? [remaining] : [];
      return index === after ? [...kept, newPile] : kept;
    });
    change(next);
    setSelected([]);
    setChapterName(null);
  }

  function unpack(pile: DeskPile) {
    const [first, ...rest] = pile.pages;
    if (!first || !rest.length) return;
    change(piles.flatMap(item => item === pile ? [
      { ...pile, pages: [first] },
      ...rest.map((page, index) => ({
        key: nextKey.current++, pages: [page],
        x: pile.x + (index % 3 + 1) * (paperWidth + 18),
        y: pile.y + Math.floor(index / 3) * (paperHeight + 40),
      })),
    ] : [item]));
    setSpread(null);
  }

  function startChapterForm(pile?: DeskPile) {
    setRenameKey(pile?.key ?? null);
    setChapterName(pile?.chapter?.title ?? "");
  }

  function submitChapter() {
    const title = chapterName?.trim();
    if (!title) return;
    if (renameKey === null) {
      bundle(title);
      return;
    }
    change(piles.map(pile => pile.key === renameKey && pile.chapter
      ? { ...pile, chapter: { ...pile.chapter, title } } : pile));
    setChapterName(null);
  }

  function moveChapter(key: number, target: number) {
    const source = chapters.findIndex(chapter => chapter.key === key);
    if (source < 0 || target < 0 || target >= chapters.length || source === target) return;
    const next = [...chapters];
    const [chapter] = next.splice(source, 1);
    next.splice(target, 0, chapter);
    change([...opening, ...next.flatMap(group => group.piles)]);
  }

  function closeChapterOrder() {
    setChapterDropKey(null);
    setChapterOrderOpen(false);
  }

  function movePile(index: number, direction: number) {
    const target = index + direction;
    const neighbor = piles[target];
    if (!neighbor || neighbor.chapter || piles[index].chapter) return;
    const next = [...piles];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-desk-action]")) return;
    const card = target.closest<HTMLElement>("[data-desk-page]");
    const handle = target.closest<HTMLElement>("[data-desk-handle]");
    const group = (card ?? handle)?.closest<HTMLElement>("[data-desk-pile]");
    drag.current = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY,
      pile: group ? Number(group.dataset.deskPile) : undefined,
      page: card ? Number(card.dataset.deskPage) : undefined,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const x = (event.clientX - current.x) / view.scale;
    const y = (event.clientY - current.y) / view.scale;
    if (!motionRef.current && Math.hypot(x, y) * view.scale < 6) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - view.x) / view.scale;
    const worldY = (event.clientY - rect.top - view.y) / view.scale;
    const target = current.page === undefined ? undefined : [...piles].reverse()
      .sort((a, b) => (layers.get(b.key) ?? 0) - (layers.get(a.key) ?? 0))
      .find(pile => {
        const inset = pile.chapter ? -clipboardInset : 25;
        const top = pile.chapter ? -clipboardTop : inset;
        const height = pile.chapter ? pileHeight(pile) : paperHeight;
        return worldX > pile.x + inset && worldX < pile.x + paperWidth - inset &&
          worldY > pile.y + top && worldY < pile.y + height - inset;
      })?.key;
    motionRef.current = { x, y, target, pile: current.pile, page: current.page };
    setMotion(motionRef.current);
  }

  function viewPile(pile: DeskPile, page?: string) {
    if (pile.pages.length > 1 || (pile.chapter && pile.pages.length === 1)) {
      spreadScrollTop.current = 0;
      setSpread(pile.key);
    } else {
      setOpenPage(page ?? pile.pages[0]?.id ?? null);
    }
  }

  function closeSpread() {
    setOpenPage(null);
    setSpread(null);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const movement = motionRef.current;
    drag.current = null;
    motionRef.current = null;
    setMotion(null);
    if (cancel) return;
    if (current.pile === undefined) {
      if (movement) setView(previous => ({
        ...previous, x: previous.x + movement.x * previous.scale, y: previous.y + movement.y * previous.scale,
      }));
      return;
    }
    const origin = piles.find(pile => pile.key === current.pile);
    if (!origin) return;
    const page = origin.pages.find(item => item.key === current.page);
    if (!movement) {
      viewPile(origin, page?.id);
      return;
    }
    const { x, y, target } = movement;
    if (page && target === origin.key && origin.pages.at(-1) === page) return;
    if (!page || (target === undefined && origin.pages.length === 1 && !origin.chapter)) {
      setRaisedPiles(current => [...current.filter(key => key !== origin.key), origin.key]);
      change(piles.map(pile => pile === origin ? { ...pile, x: pile.x + x, y: pile.y + y } : pile));
      return;
    }
    const next = piles.flatMap(pile => {
      if (pile.key === target) {
        return [{ ...pile, pages: [...pile.pages.filter(item => item.key !== page.key), page] }];
      }
      if (pile !== origin) return [pile];
      const remaining = { ...pile, pages: pile.pages.filter(item => item.key !== page.key) };
      const kept = remaining.chapter || remaining.pages.length ? [remaining] : [];
      if (target !== undefined) return kept;
      const depth = origin.pages.length - 1 - origin.pages.indexOf(page);
      return [...kept, {
        key: nextKey.current++,
        pages: [page],
        x: origin.x + stackOffsets[depth] + x,
        y: origin.y + depth * edgeHeight + y,
      }];
    });
    change(next);
  }

  function zoom(factor: number) {
    const centerX = (canvas.current?.clientWidth ?? 0) / 2;
    const centerY = (canvas.current?.clientHeight ?? 0) / 2;
    setView(previous => {
      const scale = Math.max(0.05, Math.min(1.6, previous.scale * factor));
      const ratio = scale / previous.scale;
      return { scale, x: centerX - (centerX - previous.x) * ratio, y: centerY - (centerY - previous.y) * ratio };
    });
  }

  const pan = motion?.pile === undefined ? motion : null;
  const paperTitle = (id: string) => pages.get(id)?.title ?? "参照先PAGEが見つかりません";
  return (
    <dialog
      ref={dialog}
      aria-label="原稿の机"
      onCancel={event => {
        event.preventDefault();
        if (discard) setDiscard(false);
        else if (chapterName !== null) setChapterName(null);
        else if (openPage) setOpenPage(null);
        else if (spread !== null) closeSpread();
        else if (chapterOrderOpen) closeChapterOrder();
        else closeDesk();
      }}
      className="m-auto h-[92dvh] max-h-none w-[min(96vw,1440px)] max-w-none overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 p-0 text-stone-800 shadow-2xl backdrop:bg-stone-950/40"
    >
      <div className="flex h-full flex-col">
        <header inert={overlayOpen} className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-lg font-bold">原稿の机</h2>
          <div className="flex flex-wrap gap-2">
            {!!chapters.length && <button type="button" className={actionClass} onClick={() => setChapterOrderOpen(true)}>章の順番</button>}
            <button type="button" className={actionClass} onClick={undo} disabled={!history.length}>元に戻す</button>
            <button type="button" className={actionClass} onClick={closeDesk}>閉じる</button>
            <button type="button" className={primaryClass} disabled={stale} onClick={apply}>BOOKに反映</button>
          </div>
        </header>
        <div inert={overlayOpen} className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2 text-xs">
          <p className="mr-auto">クリップをつかむと束ごと動きます。紙を重ねると、下のPAGEから順に読みます。</p>
          <button type="button" className={actionClass} onClick={() => zoom(1 / 1.2)} aria-label="縮小">−</button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button type="button" className={actionClass} onClick={() => zoom(1.2)} aria-label="拡大">＋</button>
          <button type="button" className={actionClass} onClick={fit}>全体を見る</button>
        </div>
        {stale && <p role="alert" className="bg-amber-100 px-4 py-2 text-sm">BOOKの構成が更新されました。閉じて開き直してください。</p>}
        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <div
            ref={canvas}
            inert={overlayOpen}
            aria-label="PAGEの配置"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={event => stopDrag(event)}
            onPointerCancel={event => stopDrag(event, true)}
            onLostPointerCapture={event => stopDrag(event, true)}
            className="relative isolate min-h-0 flex-1 touch-none overflow-hidden bg-stone-100 [background-image:radial-gradient(#a8a29e_0.7px,transparent_0.7px)] [background-size:24px_24px]"
          >
            {!piles.length && <p className="p-6 text-sm">BOOKにPAGEを追加すると、ここに並びます。</p>}
            <div className="absolute left-0 top-0 origin-top-left" style={{
              transform: `translate(${view.x + (pan?.x ?? 0) * view.scale}px, ${view.y + (pan?.y ?? 0) * view.scale}px) scale(${view.scale})`,
            }}>
              {piles.map(pile => {
                const active = motion?.pile === pile.key ? motion : null;
                const moveWhole = active && active.page === undefined;
                // The outline stores reading order, from the bottom of the stack to the top.
                const visible = pile.pages.slice(-stackOffsets.length).reverse();
                return (
                  <div
                    key={pile.key}
                    data-desk-pile={pile.key}
                    className="absolute isolate select-none"
                    style={{
                      width: paperWidth, height: pileHeight(pile),
                      left: pile.x + (moveWhole ? active.x : 0),
                      top: pile.y + (moveWhole ? active.y : 0),
                      zIndex: active ? raisedPiles.length + 1 : layers.get(pile.key) ?? 0,
                    }}
                  >
                    {pile.chapter ? (
                      <div
                        data-desk-handle
                        className={[
                          "absolute cursor-grab rounded-xl border bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 shadow-md",
                          motion?.target === pile.key ? "border-emerald-600 ring-2 ring-emerald-400" : "border-amber-800/40",
                        ].join(" ")}
                        style={{ top: -clipboardTop, bottom: -clipboardInset, left: -clipboardInset, right: -clipboardInset }}
                      >
                        <div aria-hidden="true" className="absolute -top-2 left-1/2 h-6 w-20 -translate-x-1/2 rounded-md border border-stone-500 bg-gradient-to-b from-white via-stone-300 to-stone-400 shadow-sm">
                          <div className="mx-auto mt-1 h-1.5 w-8 rounded-full border border-stone-400 bg-stone-500 shadow-inner" />
                        </div>
                        <div className="absolute inset-x-3 top-6 flex items-center gap-2 text-amber-950">
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] font-semibold">章 {chapterNumbers.get(pile.key)} · {pile.pages.length} PAGE</span>
                            <span className="block truncate text-sm font-bold" title={pile.chapter.title}>{pile.chapter.title}</span>
                          </div>
                          {!!pile.pages.length && (
                            <button type="button" data-desk-action onClick={() => viewPile(pile)} className="shrink-0 rounded-full border border-amber-800/30 bg-amber-50 px-2.5 py-1 text-xs font-bold hover:bg-white">見る</button>
                          )}
                        </div>
                        {visible.length === 0 && (
                          <div className="absolute inset-x-4 bottom-4 top-[76px] grid place-items-center rounded-lg border border-dashed border-amber-800/45 bg-amber-50/40 px-3 text-center text-xs font-semibold text-amber-950">
                            PAGEをここに置く
                          </div>
                        )}
                      </div>
                    ) : pile.pages.length > 1 && (
                      <div data-desk-handle className="absolute -top-9 flex w-full cursor-grab items-center gap-2 rounded bg-emerald-100 px-2 py-1 text-xs font-bold">
                        <span aria-hidden="true">⠿</span>
                        <span className="flex-1 truncate">PAGEの束</span>
                        <span>{pile.pages.length} PAGE</span>
                        <button type="button" data-desk-action onClick={() => viewPile(pile)} className="rounded bg-white px-1.5 py-0.5">見る</button>
                      </div>
                    )}
                    {visible.map((page, index) => {
                      const moving = active && active.page === page.key;
                      return (
                        <article key={page.key} data-desk-page={page.key} className={[
                          "absolute cursor-grab rounded border bg-amber-50 shadow-md",
                          selected.includes(page.key) || motion?.target === pile.key ? "border-emerald-500 ring-2 ring-emerald-300" : "border-stone-300",
                        ].join(" ")} style={{
                          width: paperWidth, height: paperHeight,
                          left: stackOffsets[index] + (moving ? active.x : 0),
                          top: index * edgeHeight + (moving ? active.y : 0),
                          transform: `rotate(${paperAngle(page.id)}deg)`,
                          zIndex: moving ? 10 : visible.length - index,
                        }}>
                          <button type="button" data-desk-action aria-label={`${paperTitle(page.id)}を選択`} aria-pressed={selected.includes(page.key)} onClick={() => select(page.key)} className="absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-full border border-stone-400 bg-white text-xs">
                            {selected.includes(page.key) ? "✓" : ""}
                          </button>
                          <button type="button" onClick={event => { if (event.detail === 0) viewPile(pile, page.id); }} className="h-full w-full cursor-grab overflow-hidden px-4 pb-8 pt-10 text-left">
                            <span className="block line-clamp-2 font-serif font-bold">{paperTitle(page.id)}</span>
                            <span className="mt-2 block line-clamp-5 whitespace-pre-line text-xs leading-relaxed text-stone-600">{pages.get(page.id)?.excerpt}</span>
                            <span className="absolute inset-x-3 bottom-1.5 flex gap-2 border-t border-stone-200 pt-1 text-[10px] text-stone-600"><span>{pageNumbers.get(page.key)}</span><span className="truncate">{paperTitle(page.id)}</span></span>
                          </button>
                        </article>
                      );
                    })}
                    {motion?.target === pile.key && <span className="pointer-events-none absolute left-6 top-20 z-20 rounded-full bg-emerald-900 px-4 py-2 text-xs text-white">続きに追加</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <aside inert={overlayOpen} className="max-h-[32%] w-full overflow-auto border-t border-stone-200 bg-white p-3 md:max-h-none md:w-64 md:border-l md:border-t-0" aria-label="本になる順番">
            <h3 className="mb-2 text-sm font-bold">本になる順番</h3>
            {piles.map((pile, index) => (
              <div key={pile.key} className="mb-2 rounded-lg bg-stone-100 p-2">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <span className="min-w-0 flex-1 break-words">{pile.chapter?.title ?? (pile.pages.length > 1 ? "PAGEの束" : "PAGE")}</span>
                  {pile.chapter ? (
                    <>
                      <button type="button" className={actionClass} onClick={() => startChapterForm(pile)}>改名</button>
                      <button type="button" className={actionClass} onClick={() => setChapterOrderOpen(true)}>順番</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={actionClass} aria-label="前へ移動" disabled={index === 0 || !!piles[index - 1]?.chapter} onClick={() => movePile(index, -1)}>↑</button>
                      <button type="button" className={actionClass} aria-label="後ろへ移動" disabled={index === piles.length - 1 || !!piles[index + 1]?.chapter} onClick={() => movePile(index, 1)}>↓</button>
                    </>
                  )}
                </div>
                {pile.pages.map(page => (
                  <div key={page.key} className="flex items-center gap-2 py-1 text-xs">
                    <input type="checkbox" aria-label={`${paperTitle(page.id)}を選択`} checked={selected.includes(page.key)} onChange={() => select(page.key)} />
                    <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setOpenPage(page.id)}>{pageNumbers.get(page.key)}　{paperTitle(page.id)}</button>
                  </div>
                ))}
              </div>
            ))}
          </aside>
          {!overlayOpen && !!selected.length && (
            <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 text-xs shadow-lg">
              <span>{selected.length} PAGE選択中</span>
              <button type="button" className={actionClass} disabled={selected.length < 2} onClick={() => bundle()}>束ねる</button>
              <button type="button" className={actionClass} onClick={() => startChapterForm()}>Chapterにする</button>
              <button type="button" className={actionClass} onClick={() => setSelected([])}>選択解除</button>
            </div>
          )}
          {overlayOpen && (
            <div
              className="absolute inset-0 z-30 grid grid-rows-[minmax(0,1fr)] place-items-center overflow-auto bg-stone-900/30 p-3 sm:p-4"
              onClick={event => {
                if (spreadPile && !openPage && event.target === event.currentTarget) closeSpread();
              }}
            >
              {chapterOrderOpen ? (
                <section aria-labelledby="paper-desk-chapter-order" className="flex max-h-full min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
                    <h3 id="paper-desk-chapter-order" className="mr-auto text-lg font-bold">章の順番</h3>
                    <button type="button" className={primaryClass} onClick={closeChapterOrder}>机に戻る</button>
                  </div>
                  <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
                    <p className="mb-3 text-xs text-stone-600">章をドラッグするか、矢印で並べ替えます。並びを確定するには、机に戻って「BOOKに反映」を押します。</p>
                    <ol className="space-y-2">
                      {chapters.map(({ chapter, key, piles: chapterPiles }, index) => (
                        <li key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${chapterDropKey === key ? "border-emerald-600 bg-emerald-50" : "border-stone-200 bg-stone-50"}`}
                          onDragOver={event => {
                            if (!event.dataTransfer.types.includes("application/x-parari-desk-chapter")) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setChapterDropKey(key);
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            const sourceKey = event.dataTransfer.getData("application/x-parari-desk-chapter");
                            if (sourceKey) moveChapter(Number(sourceKey), index);
                            setChapterDropKey(null);
                          }}
                        >
                          <span draggable aria-hidden="true" className="cursor-grab px-1 text-stone-500"
                            onDragStart={event => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("application/x-parari-desk-chapter", String(key));
                            }}
                            onDragEnd={() => setChapterDropKey(null)}
                          >⠿</span>
                          <span className="text-sm tabular-nums text-stone-500">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold">{chapter.title}</p>
                            <p className="text-xs text-stone-600">{chapterPiles.reduce((count, pile) => count + pile.pages.length, 0)} PAGE</p>
                          </div>
                          <button type="button" className={actionClass} aria-label={`${chapter.title}を前へ移動`} disabled={index === 0} onClick={() => moveChapter(key, index - 1)}>↑</button>
                          <button type="button" className={actionClass} aria-label={`${chapter.title}を後ろへ移動`} disabled={index === chapters.length - 1} onClick={() => moveChapter(key, index + 1)}>↓</button>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              ) : discard ? (
                <section aria-label="変更を破棄" className="rounded-xl bg-white p-5">
                  <p className="mb-3 text-sm">読書順や章の変更を反映せずに閉じますか？</p>
                  <button type="button" className={actionClass} onClick={() => setDiscard(false)}>机に戻る</button>{" "}
                  <button type="button" className={actionClass} onClick={onClose}>変更を破棄</button>
                </section>
              ) : chapterName !== null ? (
                <form className="w-full max-w-sm rounded-xl bg-white p-5" onSubmit={event => { event.preventDefault(); submitChapter(); }}>
                  <label className="block text-sm font-bold">章のタイトル
                    <input autoFocus required maxLength={80} value={chapterName} onChange={event => setChapterName(event.target.value)} className="my-3 block w-full rounded border border-stone-300 p-2" />
                  </label>
                  <button type="button" className={actionClass} onClick={() => setChapterName(null)}>キャンセル</button>{" "}
                  <button type="submit" className={primaryClass}>{renameKey === null ? "Chapterにする" : "名前を変更"}</button>
                </form>
              ) : openPage ? (
                <section aria-label="PAGE本文" className="flex max-h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
                    <h3 className="mr-auto min-w-0 break-words text-lg font-bold">{paperTitle(openPage)}</h3>
                    <div className="flex flex-wrap gap-2">
                      {spreadPile && <button type="button" className={actionClass} onClick={() => setOpenPage(null)}>束の中身に戻る</button>}
                      <button type="button" className={primaryClass} onClick={closeSpread}>机に戻る</button>
                    </div>
                  </div>
                  <div className="min-h-0 overflow-y-auto overscroll-contain p-4">{renderPage(openPage)}</div>
                </section>
              ) : spreadPile && (
                <section aria-label="束の中身" className="flex max-h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-stone-50">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
                    <h3 className="mr-auto min-w-0 break-words text-lg font-bold">{spreadPile.chapter?.title ?? "PAGEの束"} <span className="text-xs text-stone-600">{spreadPile.pages.length} PAGE</span></h3>
                    <div className="flex flex-wrap gap-2">
                      {spreadPile.pages.length > 1 && <button type="button" className={actionClass} onClick={() => unpack(spreadPile)}>束をばらす</button>}
                      <button type="button" className={primaryClass} onClick={closeSpread}>机に戻る</button>
                    </div>
                  </div>
                  <div
                    ref={restoreSpreadScroll}
                    onScroll={event => { spreadScrollTop.current = event.currentTarget.scrollTop; }}
                    className="min-h-0 overflow-y-auto overscroll-contain"
                  >
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 p-5">
                      {spreadPile.pages.map(page => (
                        <button key={page.key} type="button" onClick={() => setOpenPage(page.id)}
                          className="min-h-40 rounded border border-stone-200 bg-white p-3 text-left shadow hover:border-emerald-600"
                          style={{ transform: `rotate(${paperAngle(page.id)}deg)` }}>
                          <span className="block text-xs text-stone-500">PAGE {pageNumbers.get(page.key)}</span>
                          <span className="mt-1 block break-words font-serif font-bold">{paperTitle(page.id)}</span>
                          <span className="mt-2 block line-clamp-5 whitespace-pre-line text-xs leading-relaxed">{pages.get(page.id)?.excerpt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
