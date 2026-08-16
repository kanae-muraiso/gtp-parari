// apps/tools/parari/src/lib/parari/ssot-v2/patchBlocks.ts
// apps/tools/parari/src/lib/parari/ssot-v2/patchBlocks.ts
// 2026-06-23 JST - source選択 / richマーカー置換の両対応PanelBlock化

import { parseBlocks } from "./parseBlocks";

export type PanelizeTag =
  | "CHAPTER"
  | "PAGE"
  | "IMAGE"
  | "NOTICE"
  | "ACCORDION"
  | "BUTTON"
  | "LINKS"
  | "MENU"
  | "LIST"
  | "QA"
  | "VIDEO"
  | "AUDIO"
  | "YOUTUBE";
export type PanelizeSelectionResult =
  | {
      ok: true;
      ssot: string;
    }
  | {
      ok: false;
      message: string;
    };

const SINGLE_VALUE_PANELIZE_TAGS = new Set<PanelizeTag>([
  "BUTTON",
  "VIDEO",
  "AUDIO",
  "YOUTUBE",
]);

export function panelizeSelection(
  ssot: string,
  options: {
    tag: PanelizeTag;
    selectionStart: number;
    selectionEnd: number;
  }
): PanelizeSelectionResult {
  const selectionStart = Math.min(options.selectionStart, options.selectionEnd);
  const selectionEnd = Math.max(options.selectionStart, options.selectionEnd);

  if (selectionStart === selectionEnd) {
    return {
      ok: false,
      message: "パネル化する範囲を選択してください。",
    };
  }

  if (
    selectionStart < 0 ||
    selectionEnd > ssot.length ||
    selectionStart > ssot.length
  ) {
    return {
      ok: false,
      message: "選択範囲がSSOTの範囲外です。",
    };
  }

  const blocks = parseBlocks(ssot);

  const targetTextBlock = blocks.find((block) => {
    return (
      block.kind === "text" &&
      block.start <= selectionStart &&
      selectionEnd <= block.end
    );
  });

  if (!targetTextBlock || targetTextBlock.kind !== "text") {
    return {
      ok: false,
      message:
        "選択範囲が1つのTextBlock内に収まっていません。PanelBlockをまたぐ範囲はパネル化できません。",
    };
  }

  const before = ssot.slice(0, selectionStart);
  const selected = ssot.slice(selectionStart, selectionEnd);
  const after = ssot.slice(selectionEnd);

  return panelizeTextParts({
    tag: options.tag,
    before,
    selected,
    after,
  });
}

export function panelizeMarkedText(options: {
  tag: PanelizeTag;
  markedRaw: string;
  marker: string;
  selected: string;
}): PanelizeSelectionResult {
  const markerMatch = findMarkerMatch(options.markedRaw, options.marker);

  if (!markerMatch) {
    return {
      ok: false,
      message: "選択範囲のマーカーを見つけられませんでした。",
    };
  }

  const before = options.markedRaw.slice(0, markerMatch.start);
  const after = options.markedRaw.slice(markerMatch.end);

  return panelizeTextParts({
    tag: options.tag,
    before,
    selected: options.selected,
    after,
  });
}

export function panelizeTextParts(options: {
  tag: PanelizeTag;
  before: string;
  selected: string;
  after: string;
}): PanelizeSelectionResult {
  const selectedPlain = stripInlineMarkdownForPanelInitialValue(options.selected);

  if (selectedPlain.trim().length === 0) {
    return {
      ok: false,
      message: "パネル化する範囲を選択してください。",
    };
  }

  const validationResult = validatePanelizeSelection(options.tag, selectedPlain);

  if (!validationResult.ok) {
    return validationResult;
  }

  const panelRaw = createPanelRawFromSelection(options.tag, selectedPlain);
  const nextSsot = joinBeforePanelAfter(options.before, panelRaw, options.after);

  return {
    ok: true,
    ssot: nextSsot,
  };
}

function findMarkerMatch(
  markedRaw: string,
  marker: string
): { start: number; end: number } | null {
  /**
   * markerが太字・斜体の中に挿入されると、
   * export時に **marker** や *marker* になる可能性がある。
   * その場合は装飾記号ごと置き換える。
   */
  const candidates = [
    `***${marker}***`,
    `**${marker}**`,
    `*${marker}*`,
    `___${marker}___`,
    `__${marker}__`,
    `_${marker}_`,
    marker,
  ];

  for (const candidate of candidates) {
    const index = markedRaw.indexOf(candidate);

    if (index >= 0) {
      return {
        start: index,
        end: index + candidate.length,
      };
    }
  }

  return null;
}

function validatePanelizeSelection(
  tag: PanelizeTag,
  selectedPlain: string
): PanelizeSelectionResult {
  const meaningfulLines = selectedPlain
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (SINGLE_VALUE_PANELIZE_TAGS.has(tag) && meaningfulLines.length > 1) {
    return {
      ok: false,
      message:
        `${tag}化は1行だけ選択してください。\n\n` +
        "複数行をパネル化したい場合は、NOTICE / ACCORDION / LIST / LINKS / MENU / QA を使ってください。\n\n" +
        `${tag}パネルのタイトル・URL・説明は、パネル作成後に専用エディタで編集できます。`,
    };
  }

  return {
    ok: true,
    ssot: "",
  };
}

function joinBeforePanelAfter(
  before: string,
  panelRaw: string,
  after: string
): string {
  const normalizedBefore = before.replace(/\r\n/g, "\n").trimEnd();
  const normalizedPanel = panelRaw.replace(/\r\n/g, "\n").trim();
  const normalizedAfter = after.replace(/\r\n/g, "\n").trimStart();

  const textToPanelBreak = "\n\n";
  const panelToTextBreak = "\n\n\n";

  if (
    normalizedBefore.length > 0 &&
    normalizedPanel.length > 0 &&
    normalizedAfter.length > 0
  ) {
    return `${normalizedBefore}${textToPanelBreak}${normalizedPanel}${panelToTextBreak}${normalizedAfter}`;
  }

  if (normalizedBefore.length > 0 && normalizedPanel.length > 0) {
    return `${normalizedBefore}${textToPanelBreak}${normalizedPanel}`;
  }

  if (normalizedPanel.length > 0 && normalizedAfter.length > 0) {
    return `${normalizedPanel}${panelToTextBreak}${normalizedAfter}`;
  }

  if (normalizedBefore.length > 0 && normalizedAfter.length > 0) {
    return `${normalizedBefore}\n\n${normalizedAfter}`;
  }

  return normalizedBefore || normalizedPanel || normalizedAfter;
}

function stripInlineMarkdownForPanelInitialValue(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .trim();
}

function createPanelRawFromSelection(
  tag: PanelizeTag,
  selectedRaw: string
): string {
  switch (tag) {
    case "PAGE":
      return createPageRaw(selectedRaw);
    case "NOTICE":
      return createNoticeRaw(selectedRaw);

    case "ACCORDION":
      return createAccordionRaw(selectedRaw);

    case "BUTTON":
      return createButtonRaw(selectedRaw);

    case "LINKS":
      return createLinksRaw(selectedRaw);

    case "MENU":
      return createMenuRaw(selectedRaw);

    case "LIST":
      return createListRaw(selectedRaw);

    case "QA":
      return createQaRaw(selectedRaw);

    case "VIDEO":
      return createVideoRaw(selectedRaw);

    case "AUDIO":
      return createAudioRaw(selectedRaw);

    case "YOUTUBE":
      return createYoutubeRaw(selectedRaw);

    default:
      if (tag === "IMAGE") {
        return [
          "[IMAGE]",
          `url: ${selectedRaw.trim()}`,
          "caption:",
          "imageWidth: normal",
        ].join("\n");
      }

      return `[${tag}] ${selectedRaw}`;
  }
}

// src/lib/parari/ssot-v2/patchBlocks.ts
// 2026-06-29 18:55 JST
// PART: Create PAGEINFO raw from selected text
// コメント:
// - TEXT内＋や選択範囲パネル化からPAGEINFOを作る
// - 選択範囲の先頭行をPAGEタイトル候補にする
// - PAGEINFOは [PAGE] として保存する

function createPageRaw(selectedRaw: string): string {
  const selected = selectedRaw.replace(/\r\n/g, "\n").trim();
  const [firstLine, ...restLines] = selected.split("\n");

  const title = firstLine?.trim() || "新しいページ";
  const body = restLines.join("\n").trim();

  const lines = [
    `[PAGE] ${title}`,
    `title: ${title}`,
    "subtitle:",
    "mainImage:",
    "",
    "[T]",
  ];

  if (body) {
    lines.push(body);
  }

  return lines.join("\n");
}

function createNoticeRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (!selected) {
    return `[NOTICE] お知らせ
本文を入力してください。`;
  }

  const [firstLine, ...restLines] = selected.split("\n");
  const title = firstLine.trim();
  const body = restLines.join("\n").trim();

  if (!body) {
    return `[NOTICE] ${title}`;
  }

  return `[NOTICE] ${title}
${body}`;
}

function createAccordionRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (!selected) {
    return `[ACCORDION] 見出し
本文を入力してください。`;
  }

  const [firstLine, ...restLines] = selected.split("\n");
  const title = firstLine.trim();
  const body = restLines.join("\n").trim();

  if (!body) {
    return `[ACCORDION] ${title}
本文を入力してください。`;
  }

  return `[ACCORDION] ${title}
${body}`;
}

function createButtonRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (selected.startsWith("http")) {
    return `[BUTTON] 開く | ${selected}`;
  }

  return `[BUTTON] ${selected || "ボタン"} | https://example.com`;
}

function createLinksRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (!selected) {
    return `[LINKS]
リンク名 | https://example.com`;
  }

  return `[LINKS]
${selected}`;
}

function createMenuRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (!selected) {
    return `[MENU]
ホーム | /
作品リスト | /my/works
今すぐ書く | /editor/quick`;
  }

  return `[MENU]
${selected}`;
}

function createListRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (!selected) {
    return `[LIST]
- 項目1
- 項目2`;
  }

  return `[LIST]
${selected}`;
}

function createQaRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  return `[QA:select]
[Q] ${selected || "質問を入力してください"}

[A]
*選択肢1
選択肢2

[ANS]
選択肢1

[GUIDE]
解説を入力してください。`;
}

function createVideoRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (selected.startsWith("http")) {
    return `[VIDEO] ${selected}
[ASPECT] 16:9
[VIDEO_WIDTH] 100`;
  }

  return `[VIDEO] https://example.com/movie.mp4
[TITLE] ${selected || "動画タイトル"}
[ASPECT] 16:9
[VIDEO_WIDTH] 100
[CAPTION] 動画の説明`;
}

function createAudioRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (selected.startsWith("http")) {
    return `[AUDIO] ${selected}
[AUDIO_WIDTH] 100`;
  }

  return `[AUDIO] https://example.com/audio.mp3
[TITLE] ${selected || "音声タイトル"}
[AUDIO_WIDTH] 100
[CAPTION] 音声の説明`;
}

function createYoutubeRaw(selectedRaw: string): string {
  const selected = selectedRaw.trim();

  if (selected.startsWith("http")) {
    return `[YOUTUBE] ${selected}
[ASPECT] 16:9
[YOUTUBE_WIDTH] 100`;
  }

  return `[YOUTUBE] https://www.youtube.com/watch?v=xxxx
[TITLE] ${selected || "YouTube動画"}
[ASPECT] 16:9
[YOUTUBE_WIDTH] 100
[CAPTION] 動画の説明`;
}
