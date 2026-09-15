import fs from "node:fs";

const sourcePath = "src/components/parari/panels/application/ApplicationPanelRenderer.tsx";
const docsPath = "docs/APPLICATION.md";
let source = fs.readFileSync(sourcePath, "utf8");

const importAnchor = `import type { ApplicationPanelData } from "./applicationTypes";`;
if (!source.includes(importAnchor)) {
  throw new Error("Could not find application type import anchor");
}
source = source.replace(
  importAnchor,
  `${importAnchor}\n\nimport ApplicationEntryStatusPanel from "./ApplicationEntryStatusPanel";`,
);

const renderStart = source.indexOf("\n          {completedEntry ? (");
const renderEndMarker = "\n          {completedEntry &&\n          completedEntryInputFields.length >";
const renderEnd = source.indexOf(renderEndMarker, renderStart);
if (renderStart < 0 || renderEnd < 0) {
  throw new Error("Could not find completed entry status/payment render block");
}

const replacement = `\n          {completedEntry ? (\n            <ApplicationEntryStatusPanel\n              entry={completedEntry}\n              payment={entryPayment}\n              qualificationReady={qualificationReady}\n              isReportingPayment={isReportingPayment}\n              paymentMessage={paymentMessage}\n              onReportPayment={() => {\n                void reportPayment();\n              }}\n            />\n          ) : null}\n          `;
source = source.slice(0, renderStart) + replacement + source.slice(renderEnd);
fs.writeFileSync(sourcePath, source);

let docs = fs.readFileSync(docsPath, "utf8");
const supportNeedle = "- APPLICATIONラベル / status badge / info row / 日付・値の表示整形";
const supportReplacement = `${supportNeedle}\n\n\`src/components/parari/panels/application/ApplicationEntryStatusPanel.tsx\`\n\n- 申込済みユーザーの submitted / confirmed / rejected 表示\n- 現地払い / 旧支払リンク等の支払状態表示\n- 支払報告ボタンは親runtimeのactionをcallbackで呼ぶ`;
if (!docs.includes(supportNeedle)) {
  throw new Error("Could not find participant support docs block");
}
docs = docs.replace(supportNeedle, supportReplacement);
docs = docs.replace(
  "   - 状態表示 / CALENDAR予約 / FORM表示                                  次",
  "   - 申込状態 / 支払状態表示                                           完了\n   - CALENDAR予約 / FORM表示                                              次",
);
fs.writeFileSync(docsPath, docs);
