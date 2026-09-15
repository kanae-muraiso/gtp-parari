import fs from "node:fs";

const path = "docs/APPLICATION.md";
let source = fs.readFileSync(path, "utf8");

const policyNeedle = `- 値の保存そのものは親の \`ApplicationManagerLegacy.tsx\` が担当する\n\n\`src/components/parari/settings/ApplicationManagerV3Compat.tsx\``;
const policyReplacement = `- 値の保存そのものは親の \`ApplicationManagerLegacy.tsx\` が担当する\n\n### APPLICATION domain rules\n\n\`src/features/application/domain/\`\n\n- \`pricing.ts\` — CALENDAR開催回 / APPLICATION本体のどちらが正式価格かを解決する\n- \`payment.ts\` — 正式価格と支払方法から初期支払状態を決める\n- \`acceptance.ts\` — 即時確定 / 主催者承認から資格状態を決める\n- \`capacity.ts\` — 定員上限と、席を占有する申込状態を一元化する\n- \`submissionState.ts\` — payment と acceptance を合わせて初期 \`status\` を決める\n- DBの \`set_application_entry_pricing()\` と同じ業務ルールをTypeScript側でも共有する\n\n\`src/components/parari/settings/ApplicationManagerV3Compat.tsx\``;

if (!source.includes(policyNeedle)) {
  throw new Error("Could not find domain insertion point");
}
source = source.replace(policyNeedle, policyReplacement);

source = source.replace(
  "E. pricing / payment / acceptance / capacity を pure domain logic として分離\nF. guest / member 共通の submit service を作る",
  "E. pricing / payment / acceptance / capacity を pure domain logic として分離  完了\nF. guest / member 共通の submit service を作る                         次",
);

fs.writeFileSync(path, source);
