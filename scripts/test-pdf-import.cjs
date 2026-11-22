const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");

const sourcePath = path.join(__dirname, "../src/lib/parari/import/pdfToPage.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(sourcePath, module);
mod.filename = sourcePath;
mod.paths = module.paths;
mod._compile(compiled, sourcePath);
const { pageSsotFromPdf, normalizePdfText, PDF_IMPORT_MAX_CHARACTERS } = mod.exports;

assert.equal(normalizePdfText("Hello\r\nworld\r\n\r\n\r\n\r\nbye"), "Hello\nworld\n\n\nbye");
const content = "PDFの文章\n[PAGE]\n[FORM] 悪意のある文字列\n本文";
const ssot = pageSsotFromPdf("資料\nタイトル", content);
assert.equal((ssot.match(/^\[PAGE\]$/gm) || []).length, 1);
assert.ok(ssot.includes("\u200b[PAGE]"));
assert.ok(ssot.includes("\u200b[FORM]"));
assert.ok(ssot.includes("visibility: private"));
assert.ok(ssot.includes("title: 資料 タイトル"));
assert.throws(() => pageSsotFromPdf("x", " "), /文字を取り出せません/);
assert.throws(() => pageSsotFromPdf("x", "x".repeat(PDF_IMPORT_MAX_CHARACTERS + 1)), /18,000/);
console.log("PDF text import SSOT isolation tests passed");
