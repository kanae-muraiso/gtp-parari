import type { BookOutlineEntry } from "./pageRefs";

type Chapter = Extract<BookOutlineEntry, { kind: "chapter" }>;
export type DeskPage = { key: number; id: string };
export type DeskPile = { key: number; chapter?: Chapter; pages: DeskPage[]; x: number; y: number };

// Keep a little variation in the initial placement. Dragged positions are saved as-is.
const deskOffsets = [[-9, 8], [5, -11], [-4, 15], [9, -3], [7, -8], [-8, 13], [9, 1], [-5, -12]];

export function deskOutline(piles: DeskPile[]): BookOutlineEntry[] {
  return piles.flatMap(({ chapter, pages }) => [
    ...(chapter ? [chapter] : []),
    ...pages.map(({ id }): BookOutlineEntry => ({ kind: "page", id })),
  ]);
}

export function makeDesk(outline: BookOutlineEntry[], storageKey: string): DeskPile[] {
  let layout: unknown;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved?.outline === JSON.stringify(outline)) layout = saved.piles;
  } catch {
    // The desk can open without browser storage.
  }

  const piles: DeskPile[] = [];
  if (Array.isArray(layout)) {
    let offset = 0;
    for (const item of layout) {
      if (!item || !Number.isSafeInteger(item.count) || item.count <= 0 ||
          item.count > outline.length - offset || !Number.isFinite(item.x) || !Number.isFinite(item.y)) break;
      const entries = outline.slice(offset, offset + item.count);
      const chapter = entries[0]?.kind === "chapter" ? entries.shift() as Chapter : undefined;
      if (entries.some(entry => entry.kind === "chapter")) break;
      piles.push({
        key: offset, chapter, x: item.x, y: item.y,
        pages: entries.map((entry, index) => ({ id: entry.id, key: offset + Number(!!chapter) + index })),
      });
      offset += item.count;
    }
    if (offset === outline.length) return piles;
    piles.length = 0;
  }

  const rowHeight = outline.some(entry => entry.kind === "chapter") ? 405 : 310;
  let chapterPile: DeskPile | undefined;
  outline.forEach((entry, index) => {
    if (entry.kind === "page" && chapterPile) {
      chapterPile.pages.push({ key: index, id: entry.id });
      return;
    }
    const [offsetX, offsetY] = deskOffsets[piles.length % deskOffsets.length];
    const pile: DeskPile = {
      key: index,
      x: 32 + (piles.length % 4) * 258 + offsetX,
      y: 62 + Math.floor(piles.length / 4) * rowHeight + offsetY,
      pages: entry.kind === "page" ? [{ key: index, id: entry.id }] : [],
      chapter: entry.kind === "chapter" ? entry : undefined,
    };
    piles.push(pile);
    chapterPile = pile.chapter ? pile : undefined;
  });
  return piles;
}

export function saveDeskLayout(storageKey: string, outline: BookOutlineEntry[], piles: DeskPile[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      outline: JSON.stringify(outline),
      piles: piles.map(({ chapter, pages, x, y }) => ({ count: Number(!!chapter) + pages.length, x, y })),
    }));
  } catch {
    // Layout preferences are optional. The BOOK itself is saved by its editor.
  }
}
