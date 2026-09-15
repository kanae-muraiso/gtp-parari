import fs from "node:fs";
import path from "node:path";

const filePath = path.join(
  process.cwd(),
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
);

let source = fs.readFileSync(filePath, "utf8");

const policyImport =
  'import ApplicationPolicySettings from "./ApplicationPolicySettings";\n';

if (!source.includes(policyImport)) {
  throw new Error("ApplicationPolicySettings import not found.");
}

source = source.replace(
  policyImport,
  `${policyImport}import ApplicationContentBuilder from "./ApplicationContentBuilder";\n`,
);

const helperStart = source.indexOf(
  "  function renderApplicationInsertMenu(\n",
);
const helperEnd = source.indexOf(
  "\n\n  function renderValueInput(\n",
  helperStart,
);

if (helperStart < 0 || helperEnd < 0) {
  throw new Error("renderApplicationInsertMenu helper not found.");
}

source =
  source.slice(0, helperStart) +
  source.slice(helperEnd + 2);

const builderStartMarker = `            {canUseExtendedApplication &&\n            applicationMode === "builder" ? (`;
const builderEndMarker = `\n\n\n            <ApplicationPolicySettings`;

const builderStart = source.indexOf(
  builderStartMarker,
);
const builderEnd = source.indexOf(
  builderEndMarker,
  builderStart,
);

if (builderStart < 0 || builderEnd < 0) {
  throw new Error("APPLICATION content builder JSX block not found.");
}

const replacement = `            {canUseExtendedApplication &&\n            applicationMode === "builder" ? (\n              <ApplicationContentBuilder\n                blocks={blocks}\n                inputFields={inputFields}\n                forms={forms}\n                formId={formId}\n                calendarItems={calendarItems}\n                memberships={memberships}\n                onInsertInputField={\n                  insertApplicationInputField\n                }\n                onInsertResourceBlock={\n                  insertApplicationResourceBlock\n                }\n                onInputFieldKindChange={\n                  changeApplicationInputFieldKind\n                }\n                onInputFieldLabelChange={\n                  setApplicationInputFieldLabel\n                }\n                onInputFieldOptionsChange={\n                  setApplicationInputFieldOptionsText\n                }\n                onInputFieldRequiredChange={\n                  setApplicationInputFieldRequired\n                }\n                onCalendarChange={\n                  selectCalendarForBlock\n                }\n                onMembershipChange={\n                  selectMembershipForBlock\n                }\n                onMoveBlock={moveApplicationBlock}\n                onRemoveBlock={\n                  removeApplicationBlock\n                }\n              />\n            ) : null}`;

source =
  source.slice(0, builderStart) +
  replacement +
  source.slice(builderEnd);

fs.writeFileSync(filePath, source);
console.log("Extracted APPLICATION content builder UI.");
