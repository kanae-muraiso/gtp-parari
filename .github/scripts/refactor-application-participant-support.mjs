import fs from "node:fs";

const sourcePath = "src/components/parari/panels/application/ApplicationPanelRenderer.tsx";
const supportPath = "src/components/parari/panels/application/applicationPanelSupport.tsx";
const docsPath = "docs/APPLICATION.md";

let source = fs.readFileSync(sourcePath, "utf8");
const startMarker = "\ntype ApplicationField = {";
const endMarker = "\nexport default function ApplicationPanelRenderer";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  throw new Error("Could not find participant support extraction boundaries");
}

let block = source.slice(start + 1, end).trimEnd();
block = block
  .replace(/^type ([A-Za-z0-9_]+) =/gm, "export type $1 =")
  .replace(/^function ([A-Za-z0-9_]+)\(/gm, "export function $1(");

const support = `import type {\n  FormDefinitionData,\n  FormField,\n} from "../form/formTypes";\n\nimport type {\n  EventClassBrandItem,\n} from "../../EventClassBrandPanel";\n\n${block}\n`;

fs.writeFileSync(supportPath, support);

source = source.slice(0, start) + "\n" + source.slice(end);
source = source.replace(
  `import type {\n  FormDefinitionData,\n  FormField,\n} from "../form/formTypes";\n\n`,
  "",
);
source = source.replace(
  `import EventClassBrandPanel, {\n  type EventClassBrandItem,\n} from "../../EventClassBrandPanel";`,
  `import EventClassBrandPanel from "../../EventClassBrandPanel";`,
);

const applicationDataImport = `import type { ApplicationPanelData } from "./applicationTypes";`;
const supportImports = `${applicationDataImport}\n\nimport {\n  ApplicationFormFieldRenderer,\n  ApplicationInputFieldRenderer,\n  formatCalendarOccurrence,\n  getCalendarBlockItemId,\n  getCompletedEntryInputFields,\n  getMembershipBlockId,\n  getSnapshotPayment,\n  resolveFormBlockFields,\n} from "./applicationPanelSupport";\nimport type {\n  ApplicationCalendarItem,\n  ApplicationCalendarOccurrence,\n  ApplicationCalendarResponse,\n  ApplicationDefinition,\n  ApplicationForm,\n  ApplicationFormAnswers,\n  ApplicationInputAnswer,\n  ApplicationInputField,\n  ApplicationMembership,\n  ApplicationMembershipResponse,\n  LoadState,\n  PublicApplication,\n  PublicApplicationResponse,\n} from "./applicationPanelSupport";`;

if (!source.includes(applicationDataImport)) {
  throw new Error("Could not find application data import");
}
source = source.replace(applicationDataImport, supportImports);
fs.writeFileSync(sourcePath, source);

let docs = fs.readFileSync(docsPath, "utf8");
const rendererNeedle = `\`src/components/parari/panels/application/ApplicationPanelRenderer.tsx\`\n\n- PARARI 登録ユーザー側の現在の巨大ランタイム\n- 認証 / CALENDAR / FORM / 申込 / 既存申込編集 / 支払連絡 / 表示を抱えている`;
const rendererReplacement = `\`src/components/parari/panels/application/ApplicationPanelRenderer.tsx\`\n\n- PARARI 登録ユーザー側のランタイム本体\n- state / 認証 / データ取得 / 申込アクションを中心に持つ\n- 型、入力欄renderer、snapshot解析、CALENDAR/MEMBERSHIP表示補助は support へ分離済み\n\n\`src/components/parari/panels/application/applicationPanelSupport.tsx\`\n\n- 公開APPLICATIONの型\n- FIELD / FORM入力欄renderer\n- completed entry / payment snapshot解析\n- CALENDAR / MEMBERSHIP blockの読み取り・表示補助`;
if (!docs.includes(rendererNeedle)) {
  throw new Error("Could not find renderer docs block");
}
docs = docs.replace(rendererNeedle, rendererReplacement);
docs = docs.replace(
  "G. 参加者画面を小コンポーネントへ分割                                  次\nH. ApplicationManagerV3Compat を削除",
  "G. 参加者画面を小コンポーネントへ分割                                  進行中\n   - support / input renderer / snapshot解析                              完了\n   - 状態表示 / CALENDAR予約 / FORM表示                                  次\nH. ApplicationManagerV3Compat を削除",
);
fs.writeFileSync(docsPath, docs);
