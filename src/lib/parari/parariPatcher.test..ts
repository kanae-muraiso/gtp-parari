// apps/tools/parari/src/lib/parari/parariPatcher.test.ts
// 2026-04-01 JST

/**
 * PART: Imports
 * コメント:
 * - patcher公開関数のテスト
 */

import { describe, expect, it } from "vitest";
import {
  extractPage,
  insertInlineLink,
  patchBookInfo,
  patchPageApplication,
  patchPageBody,
  patchPageChapterTitle,
  patchPageImage,
  replacePage,
  splitBookSection,
  splitPages,
} from "./parariPatcher";

/**
 * PART: Test Fixtures
 * コメント:
 * - 基本SSOT
 * - BOOK + 2 PAGE
 */

const BASE_SSOT = `[BOOK] サンプルタイトル
subtitle: サブタイトル
time: 2026-04-01
place: Kyoto
topics: patcher,ssot
displayMode: book
mode: multi
cover: true
toc: true

[PAGE] はじめに
[IMAGE] https://example.com/hero.jpg
[application id="99"]
これは最初の本文です。
二行目です。

[PAGE] 第2章
[YOUTUBE] https://youtube.com/watch?v=abc123
第二ページ本文です。`;

const BOOK_ONLY_SSOT = `[BOOK] BOOKのみ
subtitle: まだページなし`;

const PAGE_WITHOUT_BODY = `[BOOK] 本
mode: multi

[PAGE] 本文なし
[IMAGE] https://example.com/no-body.jpg
[application id="22"]`;

const PAGE_WITH_BODY_ONLY = `[BOOK] 本
mode: multi

[PAGE]
本文だけです。`;

/**
 * PART: splitBookSection
 * コメント:
 * - BOOK領域とPAGE領域を安全に分離できること
 */

describe("splitBookSection", () => {
  it("最初の[PAGE]より前をBOOK領域として返す", () => {
    const result = splitBookSection(BASE_SSOT);

    expect(result.bookSection).toContain("[BOOK] サンプルタイトル");
    expect(result.bookSection).toContain("subtitle: サブタイトル");
    expect(result.bookSection).not.toContain("[PAGE] はじめに");

    expect(result.pagesSection.startsWith("[PAGE] はじめに")).toBe(true);
  });

  it("PAGEが無い場合は全文をBOOK領域として返す", () => {
    const result = splitBookSection(BOOK_ONLY_SSOT);

    expect(result.bookSection).toBe(BOOK_ONLY_SSOT);
    expect(result.pagesSection).toBe("");
  });
});

/**
 * PART: splitPages
 * コメント:
 * - PAGE独立ブロックとして切り出せること
 */

describe("splitPages", () => {
  it("複数PAGEを分割できる", () => {
    const pages = splitPages(BASE_SSOT);

    expect(pages).toHaveLength(2);
    expect(pages[0].chapterTitle).toBe("はじめに");
    expect(pages[1].chapterTitle).toBe("第2章");
    expect(pages[0].raw.startsWith("[PAGE] はじめに")).toBe(true);
    expect(pages[1].raw.startsWith("[PAGE] 第2章")).toBe(true);
  });

  it("PAGEが無ければ空配列", () => {
    expect(splitPages(BOOK_ONLY_SSOT)).toEqual([]);
  });
});

/**
 * PART: extractPage
 * コメント:
 * - 指定PAGEだけ取り出せること
 */

describe("extractPage", () => {
  it("指定indexのPAGEを返す", () => {
    const page0 = extractPage(BASE_SSOT, 0);
    const page1 = extractPage(BASE_SSOT, 1);

    expect(page0).toContain("[PAGE] はじめに");
    expect(page0).toContain("[IMAGE] https://example.com/hero.jpg");

    expect(page1).toContain("[PAGE] 第2章");
    expect(page1).toContain("[YOUTUBE] https://youtube.com/watch?v=abc123");
  });

  it("存在しないPAGE indexでは空文字を返す", () => {
    expect(extractPage(BASE_SSOT, 99)).toBe("");
  });
});

/**
 * PART: replacePage
 * コメント:
 * - 対象PAGEだけが差し替わること
 */

describe("replacePage", () => {
  it("指定PAGEのみ差し替える", () => {
    const next = replacePage(
      BASE_SSOT,
      1,
      `[PAGE] 差し替え後
差し替え本文です。`,
    );

    expect(next).toContain("[PAGE] はじめに");
    expect(next).toContain("[IMAGE] https://example.com/hero.jpg");
    expect(next).toContain("[PAGE] 差し替え後");
    expect(next).toContain("差し替え本文です。");
    expect(next).not.toContain("[PAGE] 第2章");
  });

  it("存在しないPAGE indexなら元文字列を返す", () => {
    expect(replacePage(BASE_SSOT, 99, "[PAGE] X")).toBe(BASE_SSOT);
  });
});

/**
 * PART: patchBookInfo
 * コメント:
 * - BOOK固定スロット更新
 * - 既存更新 / 新規挿入 / 削除
 */

describe("patchBookInfo", () => {
  it("既存BOOK項目を更新できる", () => {
    const next = patchBookInfo(BASE_SSOT, "subtitle", "新しいサブタイトル");

    expect(next).toContain("subtitle: 新しいサブタイトル");
    expect(next).not.toContain("subtitle: サブタイトル");
    expect(next).toContain("[PAGE] はじめに");
  });

  it("未存在項目を固定順で追加できる", () => {
    const source = `[BOOK] サンプル
subtitle: aaa
time: 2026-04-01
mode: multi

[PAGE] P1
本文`;

    const next = patchBookInfo(source, "place", "Kyoto");

    expect(next).toContain("place: Kyoto");

    const bookPart = splitBookSection(next).bookSection;
    const lines = bookPart.split("\n");

    expect(lines.indexOf("time: 2026-04-01")).toBeLessThan(lines.indexOf("place: Kyoto"));
    expect(lines.indexOf("place: Kyoto")).toBeLessThan(lines.indexOf("mode: multi"));
  });

  it("valueが空なら既存項目を削除する", () => {
    const next = patchBookInfo(BASE_SSOT, "place", "");

    expect(next).not.toContain("place: Kyoto");
    expect(next).toContain("[PAGE] はじめに");
  });

  it("存在しない項目を空指定で削除しようとしても元のまま", () => {
    const next = patchBookInfo(BASE_SSOT, "expiresAt", "");
    expect(next).toBe(BASE_SSOT);
  });
});

/**
 * PART: patchPageBody
 * コメント:
 * - 本文だけ更新し、blockを温存すること
 */

describe("patchPageBody", () => {
  it("本文のみ差し替え、IMAGEやmoduleは保持する", () => {
    const next = patchPageBody(BASE_SSOT, 0, "差し替え本文です。\n新しい二行目。");

    const page0 = extractPage(next, 0);

    expect(page0).toContain("[IMAGE] https://example.com/hero.jpg");
    expect(page0).toContain('[application id="99"]');
    expect(page0).toContain("差し替え本文です。");
    expect(page0).toContain("新しい二行目。");
    expect(page0).not.toContain("これは最初の本文です。");

    const page1 = extractPage(next, 1);
    expect(page1).toContain("[PAGE] 第2章");
    expect(page1).toContain("第二ページ本文です。");
  });

  it("本文が無いPAGEなら本文を新規追加する", () => {
    const next = patchPageBody(PAGE_WITHOUT_BODY, 0, "あとから本文追加");

    const page0 = extractPage(next, 0);
    expect(page0).toContain("[IMAGE] https://example.com/no-body.jpg");
    expect(page0).toContain('[application id="22"]');
    expect(page0).toContain("あとから本文追加");
  });
});

/**
 * PART: patchPageImage
 * コメント:
 * - メディア行の追加 / 更新 / 削除
 */

describe("patchPageImage", () => {
  it("既存IMAGEを更新できる", () => {
    const next = patchPageImage(
      BASE_SSOT,
      0,
      "IMAGE",
      "https://example.com/new.jpg",
    );

    const page0 = extractPage(next, 0);
    expect(page0).toContain("[IMAGE] https://example.com/new.jpg");
    expect(page0).not.toContain("[IMAGE] https://example.com/hero.jpg");
  });

  it("既存IMAGEを削除できる", () => {
    const next = patchPageImage(BASE_SSOT, 0, "IMAGE", "");

    const page0 = extractPage(next, 0);
    expect(page0).not.toContain("[IMAGE] https://example.com/hero.jpg");
    expect(page0).toContain('[application id="99"]');
    expect(page0).toContain("これは最初の本文です。");
  });

  it("未存在IMAGEを本文前へ挿入できる", () => {
    const next = patchPageImage(
      PAGE_WITH_BODY_ONLY,
      0,
      "IMAGE",
      "https://example.com/inserted.jpg",
    );

    const page0 = extractPage(next, 0);
    const lines = page0.split("\n");

    expect(lines[0]).toBe("[PAGE]");
    expect(lines[1]).toBe("[IMAGE] https://example.com/inserted.jpg");
    expect(lines[2]).toBe("本文だけです。");
  });

  it("別種メディアを新規追加できる", () => {
    const next = patchPageImage(BASE_SSOT, 0, "VIMEO", "https://vimeo.com/999");

    const page0 = extractPage(next, 0);
    expect(page0).toContain("[IMAGE] https://example.com/hero.jpg");
    expect(page0).toContain("[VIMEO] https://vimeo.com/999");
  });
});

/**
 * PART: patchPageApplication
 * コメント:
 * - module 1行完結
 * - 追加 / 更新 / 削除
 */

describe("patchPageApplication", () => {
  it("既存application moduleを更新できる", () => {
    const next = patchPageApplication(BASE_SSOT, 0, "application", { id: "100" });

    const page0 = extractPage(next, 0);
    expect(page0).toContain('[application id="100"]');
    expect(page0).not.toContain('[application id="99"]');
  });

  it("未存在moduleを追加できる", () => {
    const next = patchPageApplication(BASE_SSOT, 1, "contact-form", { id: "22" });

    const page1 = extractPage(next, 1);
    expect(page1).toContain('[contact-form id="22"]');
    expect(page1).toContain("[YOUTUBE] https://youtube.com/watch?v=abc123");
    expect(page1).toContain("第二ページ本文です。");
  });

  it("attrs=nullで既存moduleを削除できる", () => {
    const next = patchPageApplication(BASE_SSOT, 0, "application", null);

    const page0 = extractPage(next, 0);
    expect(page0).not.toContain('[application id="99"]');
    expect(page0).toContain("[IMAGE] https://example.com/hero.jpg");
    expect(page0).toContain("これは最初の本文です。");
  });
});

/**
 * PART: patchPageChapterTitle
 * コメント:
 * - [PAGE]行だけを安全更新
 */

describe("patchPageChapterTitle", () => {
  it("チャプター名を更新できる", () => {
    const next = patchPageChapterTitle(BASE_SSOT, 1, "新章タイトル");

    const page1 = extractPage(next, 1);
    expect(page1.startsWith("[PAGE] 新章タイトル")).toBe(true);
    expect(page1).toContain("第二ページ本文です。");
  });

  it("空文字指定なら[PAGE]単独行になる", () => {
    const next = patchPageChapterTitle(BASE_SSOT, 1, "   ");

    const page1 = extractPage(next, 1);
    expect(page1.startsWith("[PAGE]\n")).toBe(true);
  });
});

/**
 * PART: insertInlineLink
 * コメント:
 * - 本文内だけに挿入されること
 */

describe("insertInlineLink", () => {
  it("本文内の指定位置にインラインリンクを挿入できる", () => {
    const token = "⟦lk:https://example.com|表示文字⟧";
    const next = insertInlineLink(BASE_SSOT, 0, 0, "lk", "https://example.com", "表示文字");

    const page0 = extractPage(next, 0);

    expect(page0).toContain(token);
    expect(page0).toContain("[IMAGE] https://example.com/hero.jpg");
    expect(page0).toContain('[application id="99"]');
  });

  it("本文が無いPAGEなら本文として新規作成される", () => {
    const next = insertInlineLink(
      PAGE_WITHOUT_BODY,
      0,
      0,
      "lk",
      "https://example.com",
      "リンク",
    );

    const page0 = extractPage(next, 0);
    expect(page0).toContain("⟦lk:https://example.com|リンク⟧");
    expect(page0).toContain("[IMAGE] https://example.com/no-body.jpg");
  });

  it("offsetが大きすぎても末尾へ安全に入る", () => {
    const next = insertInlineLink(
      PAGE_WITH_BODY_ONLY,
      0,
      9999,
      "lk",
      "https://example.com",
      "末尾",
    );

    const page0 = extractPage(next, 0);
    expect(page0).toContain("本文だけです。⟦lk:https://example.com|末尾⟧");
  });
});
