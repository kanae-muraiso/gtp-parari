const assert = require("node:assert/strict");
const fs = require("node:fs");
const parser = fs.readFileSync("src/lib/parari/markdown/parseMarkdownForParari.ts","utf8");
const table = fs.readFileSync("src/components/parari/panels/table/tableSsot.ts","utf8");
assert.match(parser,/parseMarkdownForParari/);
assert.match(parser,/serializeTablePanel/);
assert.match(table,/\[TABLE\]/);
console.log("Markdown converter source checks passed");
