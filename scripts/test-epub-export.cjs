// scripts/test-epub-export.cjs
// 2026-10-30 JST
// PART: Exercise the real export route and inspect the generated EPUB archive.
// Database reads are simulated; the resolver, model and EPUB writer are real.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const JSZip = require("jszip");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");

function loader(mocks) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = [base, `${base}.ts`, path.join(base, "index.ts")].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (target?.endsWith(".ts")) return load(target);
      }
      return original(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600"><rect width="1200" height="1600" fill="#15374b"/><rect x="110" y="160" width="980" height="1280" rx="24" fill="none" stroke="#d49a3a" stroke-width="8"/><text x="600" y="650" text-anchor="middle" font-family="sans-serif" font-size="100" fill="#fff8e8">PARARI</text><text x="600" y="810" text-anchor="middle" font-family="sans-serif" font-size="44" fill="#fff8e8">EPUB EXPORT SAMPLE</text><text x="600" y="1190" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#d49a3a">2026.10</text></svg>`;
const coverUrl = `data:image/svg+xml;base64,${Buffer.from(coverSvg).toString("base64")}`;
const book = `[BOOK]\ntitle: PARARI EPUB出力確認用\nsubtitle: PAGEを束ねたBOOKの出力サンプル\nauthor: PARARI 検証用データ\ncoverImage: ${coverUrl}\ncover: true\ntitlePage: true\ntoc: true\n\n[BOOK_CHAPTER id=chapter-a] 第一章：PAGEの順序\n[PAGE_REF id=page-b]\n[PAGE_REF id=page-a]\n[BOOK_CHAPTER id=chapter-b] 第二章：出力の確認\n[PAGE_REF id=page-c]\n`;
const row = (id, content, extra = {}) => ({ id, owner: "owner", title: id, content, is_deleted: false, ...extra });
const samplePages = [
  row("page-a", "[PAGE]\nid: page-a\ntitle: 二番目のPAGE\n\n[T]\nこれは二番目に表示される本文です。\n\nデータベースから取得した順序ではなく、BOOKで指定した順序を使います。\n"),
  row("page-b", "[PAGE]\nid: page-b\ntitle: 一番目のPAGE\n\n[T]\nこれは一番目に表示される本文です。\n\nこのファイルは架空の検証用データから作成しました。実際の作品データは使用していません。\n"),
  row("page-c", `[PAGE]\nid: page-c\ntitle: 目次\n\n[T]\n最後のPAGEです。章扉、目次、表紙、本文の並びを確認できます。\n\n[IMAGE]\nurl: ${coverUrl}\ncaption: 表紙と同じ画像を本文でも参照しています。\n`),
];

function setup({ source = book, pages = samplePages, userId = "owner", plan = "plus", monitor = false, bookOwner = "owner", deleted = false, pageError = false, workError = false, profileError = false } = {}) {
  const saved = [row("book", source, { owner: bookOwner, is_deleted: deleted }), ...structuredClone(pages)];
  const before = JSON.stringify(saved);
  const queries = [];
  const client = {
    auth: { getUser: async token => ({ data: { user: token === "valid" && userId ? { id: userId } : null }, error: null }) },
    from(table) {
      assert.ok(["parari_books", "profiles"].includes(table));
      let rows = table === "parari_books" ? saved : [{ user_id: "owner", is_monitor: monitor }];
      const query = { table, filters: [], ids: null };
      queries.push(query);
      const result = () => ({ data: rows, error: (query.ids && pageError) || (table === "parari_books" && !query.ids && workError) || (table === "profiles" && profileError) ? { message: "simulated database failure" } : null });
      const chain = {
        select() { return chain; },
        eq(key, value) { query.filters.push([key, value]); rows = rows.filter(r => r[key] === value); return chain; },
        in(key, values) { query.ids = [...values]; rows = rows.filter(r => values.includes(r[key])); return chain; },
        maybeSingle: async () => ({ ...result(), data: rows[0] ?? null }),
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      return chain;
    },
  };
  const load = loader({
    "@/lib/billing/supabaseAdmin": { supabaseAdmin: client },
    "@/lib/billing/supabaseBilling": { getUserBillingByUserId: async () => ({ plan, billing_status: "active" }) },
  });
  const route = load("src/app/api/epub/export/route.ts");
  return {
    queries, saved,
    export: (token = "valid", body = { workId: "book" }) => route.POST(new Request("https://parari.example/api/epub/export", {
      method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
    })),
    sourceUnchanged: () => assert.equal(JSON.stringify(saved), before, "export must never mutate saved SSOT"),
    resolve: load("src/lib/parari/epub/loadEpubSource.ts").loadEpubSource,
  };
}

function xml(source) {
  return new JSDOM(source, { contentType: "application/xhtml+xml" }).window.document;
}

async function readEpub(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/epub\+zip/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.readUInt16LE(8), 0, "mimetype must be stored uncompressed");
  assert.equal(bytes.subarray(30, 30 + bytes.readUInt16LE(26)).toString(), "mimetype");
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(await zip.file("mimetype").async("string"), "application/epub+zip");
  const documents = new Map();
  for (const name of Object.keys(zip.files).filter(n => /\.(xhtml|opf|xml)$/.test(n))) {
    documents.set(name, xml(await zip.file(name).async("string")));
  }
  for (const [name, doc] of documents) {
    for (const node of doc.querySelectorAll("[href], [src]")) {
      const ref = node.getAttribute("href") ?? node.getAttribute("src");
      if (/^(https?:|data:)/.test(ref)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ref.split("#")[0] || path.posix.basename(name)));
      assert.ok(zip.file(target), `Broken EPUB resource: ${name} → ${ref}`);
    }
    for (const meta of doc.querySelectorAll('meta[property="title-type"]')) {
      const refined = doc.querySelector(meta.getAttribute("refines"));
      assert.equal(refined?.localName, "title", "title-type must refine a dc:title");
    }
  }
  const opf = documents.get("EPUB/package.opf");
  const manifest = new Map([...opf.querySelectorAll("manifest > item")].map(n => [n.id, n.getAttribute("href")]));
  const spine = [...opf.querySelectorAll("spine > itemref")].map(n => manifest.get(n.getAttribute("idref")));
  assert.ok(spine.every(Boolean));
  return { bytes, zip, documents, spine };
}

async function main() {
  const unsupported = setup({ source: "[BOOK]\ntitle: export\n\n[PAGE] 問題のPAGE\n[T]\n本文\n[FORM] フォーム" });
  const blocked = await unsupported.export();
  assert.equal(blocked.status, 422);
  const error = await blocked.json();
  assert.equal(error.code, "EPUB_UNSUPPORTED_PANELS");
  assert.match(error.message, /問題のPAGE/);
  assert.equal(error.issues[0].tag, "FORM");
  unsupported.sourceUnchanged();
  const referenceBlocked = setup({ pages: samplePages.map(page => page.id === "page-a" ? { ...page, content: page.content + "\n[FORM] 申込" } : page) });
  assert.equal((await referenceBlocked.export()).status, 422, "referenced PAGEs receive the same preflight");
  referenceBlocked.sourceUnchanged();
  const missingLink = setup({ source: "[PAGE] 動画のPAGE\n[VIDEO] javascript:alert" });
  assert.equal((await missingLink.export()).status, 422);
  const media = setup({ source: "[PAGE] 動画のPAGE\n[VIDEO] https://example.com/movie\n[TITLE] 動画を見る" });
  const mediaOutput = await readEpub(await media.export());
  assert.equal(mediaOutput.documents.get("EPUB/text/0001.xhtml").querySelector('a[href="https://example.com/movie"]').textContent, "動画を見る");
  const good = setup();
  const output = await readEpub(await good.export());
  good.sourceUnchanged();
  assert.equal(output.documents.get("EPUB/package.opf").getElementById("subtitle").textContent, "PAGEを束ねたBOOKの出力サンプル");
  assert.deepEqual(output.spine, ["cover.xhtml", "title-page.xhtml", "toc.xhtml", ...Array.from({ length: 5 }, (_, i) => `text/${String(i + 1).padStart(4, "0")}.xhtml`)]);
  const titles = output.spine.filter(p => p.startsWith("text/")).map(p => output.documents.get(`EPUB/${p}`).querySelector("h1, h2")?.textContent);
  assert.deepEqual(titles, ["第一章：PAGEの順序", "一番目のPAGE", "二番目のPAGE", "第二章：出力の確認", "目次"]);
  assert.match(output.documents.get("EPUB/text/0002.xhtml").body.textContent, /一番目に表示される本文/);
  const tocLinks = [...output.documents.get("EPUB/nav.xhtml").querySelectorAll("nav a")];
  assert.deepEqual(tocLinks.map(a => a.textContent), titles);
  assert.deepEqual(tocLinks.map(a => a.getAttribute("href")), output.spine.filter(p => p.startsWith("text/")));
  assert.equal(Object.keys(output.zip.files).filter(n => /^EPUB\/images\/[^/]+$/.test(n)).length, 1, "shared cover/body image is stored once");
  for (const query of good.queries.filter(q => q.ids)) assert.ok(query.filters.some(([k, v]) => k === "owner" && v === "owner"));
  for (const doc of output.documents.values()) assert.doesNotMatch(doc.documentElement.textContent, /PAGE_REF|BOOK_CHAPTER/);

  // A new export reads the latest saved PAGE content; repeated refs retain positions.
  const repeated = setup({ source: "[BOOK]\ntitle: Repeated\ncover: false\ntitlePage: false\ntoc: false\n\n[PAGE_REF id=page-a]\n[PAGE_REF id=page-a]" });
  repeated.saved.find(p => p.id === "page-a").content = "[PAGE]\ntitle: Updated\n\n[T]\nNew saved body";
  const repeatedOutput = await readEpub(await repeated.export());
  assert.equal(repeatedOutput.spine.length, 2);
  assert.equal(repeated.queries.find(q => q.ids).ids.length, 1);
  for (const p of repeatedOutput.spine) assert.match(repeatedOutput.documents.get(`EPUB/${p}`).body.textContent, /New saved body/);

  const fallback = setup({ source: "[BOOK]\ntitle: Fallback\n\n[PAGE_REF id=plain]", pages: [row("plain", "[T]\nLegacy plain body", { title: "PAGE title from row" })] });
  const fallbackOutput = await readEpub(await fallback.export());
  assert.match(fallbackOutput.documents.get("EPUB/text/0001.xhtml").body.textContent, /PAGE title from row.*Legacy plain body/s);

  const legacy = "[BOOK] Old Book\ncover: false\ntitlePage: false\ntoc: true\n\n[PAGE] Old Page\nOld body\n\n[IMAGE] " + coverUrl + "\n\nAfter image\n";
  const old = setup({ source: legacy, pages: [] });
  assert.equal(await old.resolve(legacy, "owner"), legacy);
  const oldOutput = await readEpub(await old.export());
  assert.match(oldOutput.documents.get("EPUB/text/0001.xhtml").body.textContent, /Old body.*After image/s);
  assert.equal(old.queries.filter(q => q.ids).length, 0);

  const chaptersOnly = setup({ source: "[BOOK]\ntitle: Chapters\n\n[BOOK_CHAPTER id=one] Chapter only", pages: [] });
  const chapterOutput = await readEpub(await chaptersOnly.export());
  assert.match(chapterOutput.documents.get("EPUB/text/0001.xhtml").body.textContent, /Chapter only/);

  // Missing, deleted, foreign-owned, empty and nested references all fail closed.
  for (const badPages of [[], [row("page-a", "[PAGE]\nBody", { is_deleted: true })], [row("page-a", "secret foreign body", { owner: "other" })], [row("page-a", "")], [row("page-a", "[BOOK]\n[PAGE_REF id=another]")]]) {
    const bad = setup({ source: "[BOOK]\ntitle: Invalid\n\n[PAGE_REF id=page-a]", pages: badPages });
    const response = await bad.export();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "EPUB_SOURCE_INCOMPLETE");
    bad.sourceUnchanged();
  }
  const failed = await setup({ pageError: true }).export();
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).code, "EPUB_PAGE_LOAD_FAILED");

  for (const [options, token, status] of [
    [{}, null, 401], [{}, "invalid", 401], [{ userId: "other" }, "valid", 404],
    [{ deleted: true }, "valid", 404], [{ plan: "free" }, "valid", 403],
  ]) {
    const denied = setup(options);
    assert.equal((await denied.export(token)).status, status);
    assert.equal(denied.queries.filter(q => q.ids).length, 0, "PAGEs are read only after authorization/plan checks");
  }
  assert.equal((await setup({ plan: "free", monitor: true }).export()).status, 200);

  const manyPages = Array.from({ length: 205 }, (_, i) => row(`p${i}`, `[PAGE]\ntitle: Page ${i}\n\n[T]\nBody ${i}`));
  const large = setup({ source: "[BOOK]\ntitle: Many\n\n" + manyPages.map(p => `[PAGE_REF id=${p.id}]`).join("\n"), pages: manyPages });
  const largeOutput = await readEpub(await large.export());
  assert.deepEqual(large.queries.filter(q => q.ids).map(q => q.ids.length), [100, 100, 5]);
  assert.equal(largeOutput.spine.filter(p => p.startsWith("text/")).length, 205);

  const sampleIndex = process.argv.indexOf("--sample");
  if (sampleIndex !== -1) {
    const destination = path.resolve(process.argv[sampleIndex + 1]);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output.bytes);
    console.log(`Sample EPUB: ${destination}`);
  }
  console.log("PASS: saved reference BOOK order, chapter dividers, navigation, cover/images, latest PAGE contents, repeated references, legacy BOOK, missing/foreign/deleted PAGE rejection, authentication, plans, batched reads, XML/resource validity and read-only SSOT.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
