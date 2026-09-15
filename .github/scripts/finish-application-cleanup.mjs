import fs from "node:fs";

function replaceExactly(text, needle, replacement, label) {
  if (!text.includes(needle)) {
    throw new Error(`Could not find ${label}`);
  }
  return text.replace(needle, replacement);
}

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

// Replace the DOM/MutationObserver compatibility layer with native v3 payment UI.
const policyPath = "src/components/parari/settings/ApplicationPolicySettings.tsx";
let policy = fs.readFileSync(policyPath, "utf8");

policy = replaceExactly(
  policy,
  `  canUseExtendedApplication: boolean;\n  paymentMethod: ApplicationPaymentMethod;`,
  `  hasCalendarBlock: boolean;\n  paymentMethod: ApplicationPaymentMethod;`,
  "ApplicationPolicySettings prop declaration",
);

policy = replaceExactly(
  policy,
  `  canUseExtendedApplication,\n  paymentMethod,`,
  `  hasCalendarBlock,\n  paymentMethod,`,
  "ApplicationPolicySettings prop destructuring",
);

policy = replaceExactly(
  policy,
  `        <p className="mt-1 text-xs leading-5 text-neutral-500">\n          支払方法は主催者が自由に決められます。\n          PARARIでは支払状況を管理します。\n        </p>`,
  `        <p className="mt-1 text-xs leading-5 text-neutral-500">\n          無料、現地払い、PARARI決済から選びます。\n          PARARI決済はSquare連携後に利用できます。\n        </p>`,
  "v3 payment intro",
);

policy = replaceExactly(
  policy,
  `            <option value="none">\n              {canUseExtendedApplication\n                ? "支払不要"\n                : "支払リンクなし"}\n            </option>\n\n            <option value="on_site">\n              当日払い\n            </option>\n\n            <option value="bank_transfer">\n              銀行振込\n            </option>\n\n            {canUseExtendedApplication ? (\n              <option value="payment_link">\n                支払リンク\n              </option>\n            ) : null}`,
  `            <option value="none">\n              無料\n            </option>\n\n            <option value="on_site">\n              現地払い\n            </option>\n\n            {paymentMethod === "bank_transfer" ? (\n              <option value="bank_transfer">\n                銀行振込（旧設定）\n              </option>\n            ) : null}\n\n            {paymentMethod === "payment_link" ? (\n              <option value="payment_link">\n                支払リンク（旧設定）\n              </option>\n            ) : null}\n\n            <option\n              value="__parari_pending__"\n              disabled\n            >\n              PARARI決済（準備中）\n            </option>`,
  "v3 payment options",
);

policy = replaceExactly(
  policy,
  `        {paymentMethod !== "none" ? (\n          <>\n            <div className="mt-4">\n              <label className="block text-xs font-bold text-neutral-600">\n                参加費\n              </label>\n\n              <div className="mt-2 flex items-center gap-2">\n                <input\n                  type="number"\n                  min="0"\n                  step="1"\n                  inputMode="numeric"\n                  value={paymentAmount}\n                  onChange={(event) =>\n                    onPaymentAmountChange(\n                      event.target.value,\n                    )\n                  }\n                  placeholder="3000"\n                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"\n                />\n\n                <span className="shrink-0 text-sm text-neutral-500">\n                  円\n                </span>\n              </div>\n            </div>`,
  `        {hasCalendarBlock && paymentMethod !== "none" ? (\n          <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">\n            <div className="text-sm font-bold text-neutral-900">\n              料金は各開催回で設定します\n            </div>\n            <p className="mt-1 text-xs leading-5 text-neutral-500">\n              CALENDARを使う募集では、APPLICATION側に参加費を重複して設定しません。\n            </p>\n          </div>\n        ) : null}\n\n        {paymentMethod !== "none" ? (\n          <>\n            {!hasCalendarBlock ? (\n              <div className="mt-4">\n                <label className="block text-xs font-bold text-neutral-600">\n                  参加費\n                </label>\n\n                <div className="mt-2 flex items-center gap-2">\n                  <input\n                    type="number"\n                    min="0"\n                    step="1"\n                    inputMode="numeric"\n                    value={paymentAmount}\n                    onChange={(event) =>\n                      onPaymentAmountChange(\n                        event.target.value,\n                      )\n                    }\n                    placeholder="3000"\n                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"\n                  />\n\n                  <span className="shrink-0 text-sm text-neutral-500">\n                    円\n                  </span>\n                </div>\n              </div>\n            ) : null}`,
  "native CALENDAR pricing UI",
);

fs.writeFileSync(policyPath, policy);

const legacyPath = "src/components/parari/settings/ApplicationManagerLegacy.tsx";
let legacy = fs.readFileSync(legacyPath, "utf8");

legacy = replaceExactly(
  legacy,
  `      const normalizedPaymentAmount =\n        paymentAmount.trim();\n\n      if (\n        paymentMethod !== "none"\n      ) {`,
  `      const hasCalendarPricing =\n        blocks.some(\n          (block) =>\n            block?.type === "calendar",\n        );\n\n      const normalizedPaymentAmount =\n        paymentAmount.trim();\n\n      if (\n        paymentMethod !== "none" &&\n        !hasCalendarPricing\n      ) {`,
  "calendar-aware payment validation",
);

legacy = replaceExactly(
  legacy,
  `                  paymentAmount:\n                    paymentMethod ===\n                    "none"\n                      ? null\n                      : Number(\n                          normalizedPaymentAmount,\n                        ),`,
  `                  paymentAmount:\n                    paymentMethod === "none" ||\n                    hasCalendarPricing\n                      ? null\n                      : Number(\n                          normalizedPaymentAmount,\n                        ),`,
  "calendar-aware payment payload",
);

legacy = replaceExactly(
  legacy,
  `            <ApplicationPolicySettings\n              canUseExtendedApplication={\n                canUseExtendedApplication\n              }\n              paymentMethod={paymentMethod}`,
  `            <ApplicationPolicySettings\n              hasCalendarBlock={\n                blocks.some(\n                  (block) =>\n                    block?.type === "calendar",\n                )\n              }\n              paymentMethod={paymentMethod}`,
  "ApplicationPolicySettings caller",
);

fs.writeFileSync(legacyPath, legacy);

const managerPath = "src/components/parari/settings/ApplicationManager.tsx";
fs.writeFileSync(
  managerPath,
  `"use client";\n\nimport * as React from "react";\n\n// Stable creator-side entry point for APPLICATION.\n// The implementation is delegated to ApplicationManagerLegacy.tsx.\n// Architecture map: /docs/APPLICATION.md\nimport ApplicationManagerLegacy, {\n  type ApplicationManagerCreatedApplication,\n} from "./ApplicationManagerLegacy";\n\nexport type { ApplicationManagerCreatedApplication };\n\ntype ApplicationManagerProps =\n  React.ComponentProps<typeof ApplicationManagerLegacy>;\n\nexport default function ApplicationManager(\n  props: ApplicationManagerProps,\n) {\n  return (\n    <ApplicationManagerLegacy {...props} />\n  );\n}\n`,
);

const compatPath = "src/components/parari/settings/ApplicationManagerV3Compat.tsx";
if (!fs.existsSync(compatPath)) {
  throw new Error("Expected ApplicationManagerV3Compat.tsx before final removal");
}
fs.unlinkSync(compatPath);

const docsPath = "docs/APPLICATION.md";
let docs = fs.readFileSync(docsPath, "utf8");

const compatLocation = `\n\`src/components/parari/settings/ApplicationManagerV3Compat.tsx\`\n\n- 一時的な互換レイヤー\n- 既存画面に v3 の支払 UI を適用するための DOM 互換処理\n- 本体分割後に削除する\n`;
docs = replaceExactly(
  docs,
  compatLocation,
  "\n",
  "obsolete ApplicationManagerV3Compat architecture block",
);

const debtBlock = `### B. \`ApplicationPanelRenderer.tsx\` が巨大\n\n表示と申込ロジックが密結合しています。\n\n### C. \`ApplicationManagerV3Compat.tsx\` は一時処置\n\n\`MutationObserver\` で既存 UI を補正しています。長期的な本体ではありません。\n\n### D. submit経路の共通化は完了\n`;
const debtReplacement = `### B. \`ApplicationPanelRenderer.tsx\` は participant orchestration を担当\n\n型・入力欄renderer・snapshot解析・表示helper・申込状態/支払状態表示は分離済みです。\n認証、データ取得、申込action、CALENDAR / FORM の構成は runtime の orchestration 責務として意図的に残します。\n今後は新機能の責務境界が明確になった時だけ追加分割します。\n\n### C. submit経路の共通化は完了\n`;
docs = replaceExactly(
  docs,
  debtBlock,
  debtReplacement,
  "APPLICATION technical-debt block",
);
docs = docs.replace(
  "### E. manual CALENDAR block の非対称は解消済み",
  "### D. manual CALENDAR block の非対称は解消済み",
);

const roadmap = `G. 参加者画面を小コンポーネントへ分割                                  進行中\n   - support / input renderer / snapshot解析                              完了\n   - 申込状態 / 支払状態表示                                           完了\n   - CALENDAR予約 / FORM表示                                              次\nH. ApplicationManagerV3Compat を削除`;
const roadmapReplacement = `G. 参加者画面を責務ごとに分割                                        完了\n   - support / input renderer / snapshot解析                              完了\n   - 申込状態 / 支払状態表示                                             完了\n   - CALENDAR / FORM は runtime orchestration として意図的に維持          完了\nH. ApplicationManagerV3Compat を正規UIへ統合して削除                      完了`;
docs = replaceExactly(
  docs,
  roadmap,
  roadmapReplacement,
  "APPLICATION cleanup roadmap block",
);

const afterRoadmap = "```\n\nその後に機能追加へ";
const completedRoadmap = "```\n\n**②.5 APPLICATION 大掃除: 2026-09-15 完了**\n\nその後に機能追加へ";
docs = replaceExactly(
  docs,
  afterRoadmap,
  completedRoadmap,
  "roadmap closing marker",
);

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
