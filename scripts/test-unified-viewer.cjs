// 2026-10-07 20:15 JST
// PART: Compatibility, shared rendering and reading-progress regression checks
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
}
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
const { buildViewerDocument } = require("../src/components/parari/viewer-v2/buildViewerDocument.ts");
const { buildBookSheets } = require("../src/components/parari/viewer-v2/book/buildBookSheets.ts");
const progress = require("../src/components/parari/viewer-v2/readerProgress.ts");
const { ParariViewer } = require("../src/components/parari/viewer-v2/ParariViewer.tsx");
const { ReaderToolbar } = require("../src/components/parari/viewer-v2/ReaderToolbar.tsx");

const body = "Hello [[漢字|かんじ]] world.\n\n## First heading\n\nOriginal text.";
const bookSource = `[BOOK]\ntitle: Existing book\nauthor: Author\ndefaultReadingMode: scroll\n\n[CHAPTER] First chapter\n\n[PAGE] First page\n[IMAGE] https://example.com/legacy.png\n${body}\n\n[PAGE] Second page\nSecond original body.`;
const pageSource = `[PAGE]\ntitle: Existing page\n\n[T]\n${body}\n\n[TOC]\n\n[T]\n## Second heading\n\nSecond text.\n\n[NOTICE]\ntext: Important notice`;
const webSource = `[WEB]\ntitle: Existing website\nhomePageSlug: home\ntopBrandName: Existing brand\n\n[WEBPAGE]\npageType: top\ntitle: Home\nslug: home\nisHome: true\n\n[T]\nHome text.\n\n[BUTTON] About | page:about\n[/WEBPAGE]\n\n[WEBPAGE]\npageType: fixed\ntitle: About\nslug: about\n\n[T]\n${body}\n[/WEBPAGE]`;

const book = buildViewerDocument({ content: bookSource, workId: "book-id" });
assert.equal(book.format, "book");
const { storageId, restoreLegacyProgress, ...composedBook } = book.book;
assert.deepEqual(composedBook, buildBookSheets(bookSource), "Existing BOOK composition must not change");
assert.ok(book.book.pageSheets.some(sheet => sheet.mainImage === "https://example.com/legacy.png" || sheet.bodySsot.includes("https://example.com/legacy.png")));
assert.ok(book.book.pageSheets.some(sheet => sheet.bodySsot.includes("Second original body")));
const page = buildViewerDocument({ content: pageSource, workId: "page-id" });
assert.equal(page.format, "page");
assert.equal(page.book.sheets.length, 1);
assert.equal(page.book.sheets[0].bodySsot, pageSource, "PAGE panels and metadata remain intact");
assert.equal(page.book.title, "Existing page");
const web = buildViewerDocument({ content: webSource, workId: "web-id", publicBasePath: "/author/site" });
const about = buildViewerDocument({ content: webSource, workId: "web-id", publicBasePath: "/author/site", pageSlug: "about" });
assert.equal(web.format, "web");
assert.equal(web.web.selectedPage.slug, "home");
assert.match(web.book.sheets[0].bodySsot, /\/author\/site\/about/);
assert.equal(about.web.selectedPage.slug, "about");
assert.doesNotMatch(about.book.sheets[0].bodySsot, /Home text/);
assert.notEqual(progress.readingPositionStorageKey(web.book), progress.readingPositionStorageKey(about.book));
assert.equal(buildViewerDocument({ content: webSource, pageSlug: "missing" }).web.selectedPage, null);
assert.equal(buildViewerDocument({ content: "" }).book.sheets.length, 0);

for (const [content, format] of [[bookSource, "book"], [pageSource, "page"], [webSource, "web"]]) {
  const html = renderToStaticMarkup(React.createElement(ParariViewer, { content, publicBasePath: "/author/site" }));
  assert.match(html, new RegExp(`data-parari-viewer="${format}"`));
  assert.equal((html.match(/aria-label="読書ツールバー"/g) || []).length, 1);
  assert.match(html, /読書設定を開く/);
  assert.doesNotMatch(html, /\[BOOK\]|\[WEBPAGE\]|\[PAGEINFO\]/, "Do not add raw structure to rendered HTML");
}
const pageHtml = renderToStaticMarkup(React.createElement(ParariViewer, { content: pageSource }));
assert.match(pageHtml, /First heading/);
assert.match(pageHtml, /Second heading/);
assert.match(pageHtml, /Important notice/);
const ids = [...pageHtml.matchAll(/id="(parari-page-heading-[^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, 2);
assert.equal(new Set(ids).size, ids.length, "Headings across text blocks must use distinct anchors");
const toolbarHtml = renderToStaticMarkup(React.createElement(ReaderToolbar, {
  book: page.book, currentSheet: page.book.sheets[0], currentSheetId: "reader-page-1", menuOpen: false, settingsOpen: true,
  pageNumberBySheetId: {}, displayMode: "full-scroll", fontSize: "standard", fontFamily: "standard", dictionaryMode: "off", rubyMode: "click",
}));
for (const label of ["全文スクロール", "PAGEスクロール", "ページめくり", "文字サイズ", "書体", "語注", "ルビ", "読書位置をリセット"]) assert.ok(toolbarHtml.includes(label));

const storage = new Map();
global.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
const legacyBook = { ...book.book, storageId: "" };
storage.set(progress.readingModeStorageKey(legacyBook), "paged");
storage.set(progress.readingPositionStorageKey(legacyBook), JSON.stringify({ mode: "paged", sheetId: "old-sheet", progressRatio: 0.6 }));
assert.equal(progress.readStoredReaderDisplayMode(book.book), book.book.physicalPagination ? "page-turn" : "page-scroll");
assert.equal(progress.readStoredReadingProgress(book.book).progressRatio, 0.6);
progress.storeReaderDisplayMode(book.book, "full-scroll");
assert.equal(progress.readStoredReaderDisplayMode(book.book), "full-scroll");
progress.writeStoredReadingProgress(book.book, { mode: "scroll", sheetId: "new-sheet", progressRatio: 0.4, updatedAt: "now" });
assert.equal(progress.readStoredReadingProgress(book.book).sheetId, "new-sheet");
const other = { ...book.book, storageId: "other-work", restoreLegacyProgress: false };
assert.equal(progress.readStoredReadingProgress(other), null);
progress.clearReadingProgress(book.book);
assert.equal(progress.readStoredReadingProgress(book.book), null, "Reset must not resurrect legacy progress");
storage.set(progress.readingPositionStorageKey(book.book), "invalid-json");
assert.equal(progress.readStoredReadingProgress(book.book), null);
global.window = { get localStorage() { throw new Error("storage disabled"); } };
assert.equal(progress.readStoredReadingProgress(book.book), null);
assert.equal(progress.readStoredReaderDisplayMode(book.book), null);
assert.doesNotThrow(() => progress.storeReaderDisplayMode(book.book, "page-turn"));
assert.doesNotThrow(() => progress.clearReadingProgress(book.book));
delete global.window;
console.log("PASS: BOOK compatibility, complete PAGE panels, WEB selection/links, shared toolbar/body, legacy and isolated progress, reset and unavailable storage.");
