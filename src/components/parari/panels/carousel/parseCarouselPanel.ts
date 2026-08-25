import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";
import type {
  CarouselCardData,
  CarouselPanelData,
} from "./carouselTypes";

type SourceLine = {
  text: string;
  start: number;
  end: number;
};

export function parseCarouselPanel(
  raw: string,
  _block?: PanelBlock,
): CarouselPanelData {
  const source = normalizeNewlines(raw);
  const lines = splitLinesWithOffsets(source);

  const openingIndex = lines.findIndex((line) =>
    /^\s*\[CAROUSEL(?:\:[^\]]+)?\]\s*$/i.test(line.text),
  );

  if (openingIndex < 0) {
    return { cards: [] };
  }

  const closingIndex = lines.findIndex(
    (line, index) =>
      index > openingIndex &&
      /^\s*\[\/CAROUSEL\]\s*$/i.test(line.text),
  );

  const bodyStart = lines[openingIndex]?.end ?? 0;
  const bodyEnd =
    closingIndex >= 0
      ? lines[closingIndex]?.start ?? source.length
      : source.length;

  return {
    cards: parseCards(source.slice(bodyStart, bodyEnd)),
  };
}

function parseCards(source: string): CarouselCardData[] {
  const lines = splitLinesWithOffsets(source);
  const cards: CarouselCardData[] = [];

  let cardBodyStart: number | null = null;

  for (const line of lines) {
    if (/^\s*\[CARD\]\s*$/i.test(line.text)) {
      if (cardBodyStart === null) {
        cardBodyStart = line.end;
      }

      continue;
    }

    if (/^\s*\[\/CARD\]\s*$/i.test(line.text)) {
      if (cardBodyStart === null) {
        continue;
      }

      cards.push({
        id: `card-${cards.length + 1}`,
        bodySsot: source.slice(cardBodyStart, line.start).trim(),
      });

      cardBodyStart = null;
    }
  }

  return cards;
}

function normalizeNewlines(value: string): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function splitLinesWithOffsets(input: string): SourceLine[] {
  if (!input) {
    return [];
  }

  const lines: SourceLine[] = [];
  let start = 0;

  while (start < input.length) {
    const newlineIndex = input.indexOf("\n", start);
    const end =
      newlineIndex === -1 ? input.length : newlineIndex + 1;

    const raw = input.slice(start, end);

    lines.push({
      text: raw.replace(/\r?\n$/, ""),
      start,
      end,
    });

    start = end;
  }

  return lines;
}
