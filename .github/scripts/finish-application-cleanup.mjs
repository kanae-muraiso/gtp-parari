import fs from "node:fs";

const backups = [
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-blocks-20260825",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-choice-field-config-20260829-130801",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-choice-field-config-safe-20260829-131010",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-form-input-catalog-20260827-170628",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-input-fields-20260826",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-layout-builder-20260826",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-lite-builder-mode-20260826",
  "src/components/parari/panels/application/applicationTypes.ts.backup-before-single-form-20260825",
];

for (const path of backups) {
  if (!fs.existsSync(path)) {
    throw new Error(`Expected APPLICATION backup is missing before cleanup: ${path}`);
  }
  fs.unlinkSync(path);
}

const docsPath = "docs/APPLICATION.md";
let docs = fs.readFileSync(docsPath, "utf8");

const compatLocation = `\n\`src/components/parari/settings/ApplicationManagerV3Compat.tsx\`\n\n- 一時的な互換レイヤー\n- 既存画面に v3 の支払 UI を適用するための DOM 互換処理\n- 本体分割後に削除する\n`;
if (!docs.includes(compatLocation)) {
  throw new Error("Could not find obsolete ApplicationManagerV3Compat architecture block");
}
docs = docs.replace(compatLocation, "\n");

const debtBlock = `### B. \`ApplicationPanelRenderer.tsx\` が巨大\n\n表示と申込ロジックが密結合しています。\n\n### C. \`ApplicationManagerV3Compat.tsx\` は一時処置\n\n\`MutationObserver\` で既存 UI を補正しています。長期的な本体ではありません。\n\n### D. submit経路の共通化は完了\n`;
const debtReplacement = `### B. \`ApplicationPanelRenderer.tsx\` は participant orchestration を担当\n\n型・入力欄renderer・snapshot解析・表示helper・申込状態/支払状態表示は分離済みです。\n認証、データ取得、申込action、CALENDAR / FORM の構成は runtime の orchestration 責務として意図的に残します。\n今後は新機能の責務境界が明確になった時だけ追加分割します。\n\n### C. submit経路の共通化は完了\n`;
if (!docs.includes(debtBlock)) {
  throw new Error("Could not find APPLICATION technical-debt block");
}
docs = docs.replace(debtBlock, debtReplacement);
docs = docs.replace("### E. manual CALENDAR block の非対称は解消済み", "### D. manual CALENDAR block の非対称は解消済み");

const roadmap = `G. 参加者画面を小コンポーネントへ分割                                  進行中\n   - support / input renderer / snapshot解析                              完了\n   - 申込状態 / 支払状態表示                                           完了\n   - CALENDAR予約 / FORM表示                                              次\nH. ApplicationManagerV3Compat を削除`;
const roadmapReplacement = `G. 参加者画面を責務ごとに分割                                        完了\n   - support / input renderer / snapshot解析                              完了\n   - 申込状態 / 支払状態表示                                             完了\n   - CALENDAR / FORM は runtime orchestration として意図的に維持          完了\nH. ApplicationManagerV3Compat の不在を確認                               完了`;
if (!docs.includes(roadmap)) {
  throw new Error("Could not find APPLICATION cleanup roadmap block");
}
docs = docs.replace(roadmap, roadmapReplacement);

const afterRoadmap = "```\n\nその後に機能追加へ";
const completedRoadmap = "```\n\n**②.5 APPLICATION 大掃除: 2026-09-15 完了**\n\nその後に機能追加へ";
if (!docs.includes(afterRoadmap)) {
  throw new Error("Could not find roadmap closing marker");
}
docs = docs.replace(afterRoadmap, completedRoadmap);

fs.writeFileSync(docsPath, docs);

const remainingBackups = fs.readdirSync("src/components/parari/panels/application")
  .filter((name) => name.startsWith("applicationTypes.ts.backup-before-"));
if (remainingBackups.length > 0) {
  throw new Error(`APPLICATION backups still remain: ${remainingBackups.join(", ")}`);
}

for (const root of ["src", "docs"]) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(?:ts|tsx|md)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        if (text.includes("ApplicationManagerV3Compat")) {
          throw new Error(`Obsolete V3Compat reference remains: ${full}`);
        }
      }
    }
  }
}

console.log("APPLICATION cleanup checks passed: backups=0, V3Compat refs=0");
