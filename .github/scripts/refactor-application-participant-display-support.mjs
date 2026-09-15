import fs from "node:fs";

const sourcePath = "src/components/parari/panels/application/ApplicationPanelRenderer.tsx";
const supportPath = "src/components/parari/panels/application/applicationPanelSupport.tsx";
const docsPath = "docs/APPLICATION.md";

let source = fs.readFileSync(sourcePath, "utf8");
let support = fs.readFileSync(supportPath, "utf8");

const marker = `\n// ========================================================\n// UI helpers\n// ========================================================`;
const start = source.indexOf(marker);
if (start < 0) {
  throw new Error("Could not find participant display helper boundary");
}

let block = source.slice(start + 1).trimEnd();
block = block.replace(/^function ([A-Za-z0-9_]+)\(/gm, "export function $1(");
support = `${support.trimEnd()}\n\n\n${block}\n`;
fs.writeFileSync(supportPath, support);
source = source.slice(0, start).trimEnd() + "\n";

const importNeedle = `import {\n  ApplicationFormFieldRenderer,\n  ApplicationInputFieldRenderer,`;
const importReplacement = `import {\n  ApplicationFormFieldRenderer,\n  ApplicationInputFieldRenderer,\n  ApplicationLabel,\n  InfoRow,\n  StatusBadge,\n  applicationTypeLabel,\n  defaultActionLabel,\n  formatFieldValue,`;
if (!source.includes(importNeedle)) {
  throw new Error("Could not find participant support value imports");
}
source = source.replace(importNeedle, importReplacement);
source = source.replace(
  `  getMembershipBlockId,\n  getSnapshotPayment,`,
  `  getMembershipBlockId,\n  getSnapshotPayment,\n  normalizeText,`,
);
fs.writeFileSync(sourcePath, source);

let docs = fs.readFileSync(docsPath, "utf8");
docs = docs.replace(
  "- completed entry / payment snapshot解析\n- CALENDAR / MEMBERSHIP blockの読み取り・表示補助",
  "- completed entry / payment snapshot解析\n- CALENDAR / MEMBERSHIP blockの読み取り・表示補助\n- APPLICATIONラベル / status badge / info row / 日付・値の表示整形",
);
fs.writeFileSync(docsPath, docs);
