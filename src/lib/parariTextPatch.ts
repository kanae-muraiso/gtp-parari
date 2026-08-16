// apps/tools/parari/src/lib/parariTextPatch.ts
// 2026-03-05 13:10 JST

/**
 * PART: parariTextPatch（フォーム→SSOTの最小パッチ）
 * コメント:
 * - “n番目の[PAGE]”の範囲だけを安全に書き換える
 * - [LINK] は温存（フォームでは触らない）
 * - 画像は [IMAGE] 1行のみ扱う（URLが空なら削除）
 */

type PatchInput = {
  pageIndex: number;
  bookTitle?: string;          // 変えないならundefined
  chapterTitleRaw?: string;    // 継承させたいなら ""（空）を渡す
  imageUrl?: string;           // 空なら削除
  body?: string;               // 変えないならundefined
};

function isTagLine(line: string, tag: string) {
  return line.trimStart().startsWith(tag);
}
function trimTagLine(raw: string, tag: string) {
  return raw.trim().replace(tag, "").trim();
}

function ensureBookLine(lines: string[], nextBookTitle?: string) {
  // 先頭に [BOOK] が無ければ挿入
  if (lines.length === 0) {
    lines.push(`[BOOK] ${nextBookTitle ?? ""}`.trimEnd());
    return;
  }
  if (!isTagLine(lines[0], "[BOOK]")) {
    lines.unshift(`[BOOK] ${nextBookTitle ?? ""}`.trimEnd());
    return;
  }
  if (typeof nextBookTitle === "string") {
    lines[0] = `[BOOK] ${nextBookTitle}`.trimEnd();
  }
}

function findPageLineIndexes(lines: string[]) {
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTagLine(lines[i], "[PAGE]")) idxs.push(i);
  }
  return idxs;
}

function splitPageBlock(lines: string[], pageStartIdx: number, pageEndIdx: number) {
  const head = lines.slice(0, pageStartIdx);
  const block = lines.slice(pageStartIdx, pageEndIdx);
  const tail = lines.slice(pageEndIdx);
  return { head, block, tail };
}

function rewritePageLine(oldLine: string, chapterTitleRaw?: string) {
  if (typeof chapterTitleRaw !== "string") return oldLine;
  const t = chapterTitleRaw.trim();
  return t.length > 0 ? `[PAGE] ${t}` : `[PAGE]`;
}

function rewriteImageLine(blockLines: string[], imageUrl?: string) {
  // blockLines[0] は [PAGE] 行
  // その直後の “ヘッダー領域” で [IMAGE] を1行だけ扱う
  // [LINK] は温存
  const url = typeof imageUrl === "string" ? imageUrl.trim() : undefined;

  // まず既存の [IMAGE] を削除（ヘッダー領域のみ）
  // ヘッダー領域＝本文が始まるまで（最初の非タグ行が本文扱い）
  const out: string[] = [];
  out.push(blockLines[0]);

  let i = 1;
  // 先頭の空行は許容してスキップ
  while (i < blockLines.length && blockLines[i].trim() === "") {
    out.push(blockLines[i]);
    i++;
  }

  // ヘッダータグ列を処理
  // ここでは [IMAGE] のみ削除対象、[LINK]は温存
  while (i < blockLines.length) {
    const line = blockLines[i];
    const t = line.trim();
    if (t === "") {
      out.push(line);
      i++;
      continue;
    }
    if (isTagLine(line, "[IMAGE]")) {
      // 既存IMAGEは捨てる
      i++;
      continue;
    }
    if (isTagLine(line, "[LINK]")) {
      out.push(line);
      i++;
      continue;
    }
    // その他は本文開始
    break;
  }

  // ここで “新IMAGEを挿入” したいなら、[LINK]より前に入れるのが理想だが、
  // 既に [LINK] が out に入っている可能性がある。
  // なので方針： out の中で [PAGE]直後（空行の後）に挿入する（LINKより前になりやすい）
  if (url && url.length > 0) {
    // out内の挿入位置＝最初の [LINK] が出る直前、なければ out.length
    let insertPos = out.length;
    for (let k = 1; k < out.length; k++) {
      if (isTagLine(out[k], "[LINK]")) {
        insertPos = k;
        break;
      }
    }
    out.splice(insertPos, 0, `[IMAGE] ${url}`);
  }

  // 残り（本文以降）をそのまま付ける
  while (i < blockLines.length) {
    out.push(blockLines[i]);
    i++;
  }
  return out;
}

function rewriteBody(blockLines: string[], body?: string) {
  if (typeof body !== "string") return blockLines;

  // 本文開始位置を探す（[PAGE]の後、空行を飛ばし、[IMAGE]/[LINK]を飛ばした後）
  let i = 1;
  while (i < blockLines.length && blockLines[i].trim() === "") i++;

  // ヘッダー領域のタグを飛ばす
  while (i < blockLines.length) {
    const line = blockLines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (isTagLine(line, "[IMAGE]") || isTagLine(line, "[YOUTUBE]") || isTagLine(line, "[LINK]")) {
      i++;
      continue;
    }
    break;
  }

  const header = blockLines.slice(0, i);
  const nextBody = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 本文は “そのまま” 入れる（空でもOK：ただし空ページ禁止ルールがあるなら後段でlint）
  const newBlock = [...header, ...nextBody.split("\n")];
  return newBlock;
}

export function patchParariText(text: string, patch: PatchInput): string {
  const lines = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  ensureBookLine(lines, patch.bookTitle);

  const pageIdxs = findPageLineIndexes(lines);
  if (pageIdxs.length === 0) {
    // [PAGE] が無い → 末尾に追加して作る（v0救済）
    lines.push("");
    lines.push("[PAGE]");
  }

  const pageIdxs2 = findPageLineIndexes(lines);
  const start = pageIdxs2[Math.min(patch.pageIndex, pageIdxs2.length - 1)];
  const end = patch.pageIndex + 1 < pageIdxs2.length ? pageIdxs2[patch.pageIndex + 1] : lines.length;

  const { head, block, tail } = splitPageBlock(lines, start, end);

  // 1) PAGE行
  if (block.length > 0) {
    block[0] = rewritePageLine(block[0], patch.chapterTitleRaw);
  }

  // 2) IMAGE
  let newBlock = rewriteImageLine(block, patch.imageUrl);

  // 3) BODY
  newBlock = rewriteBody(newBlock, patch.body);

  return [...head, ...newBlock, ...tail].join("\n");
}

export function appendNewPage(text: string, opts?: { chapterTitleRaw?: string }) {
  const t = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chapter = (opts?.chapterTitleRaw ?? "").trim();
  const pageLine = chapter ? `[PAGE] ${chapter}` : `[PAGE]`;
  const suffix = `\n\n${pageLine}\n`;
  return t.trimEnd() + suffix;
}
