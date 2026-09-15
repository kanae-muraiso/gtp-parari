import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const legacyPath = path.join(
  root,
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
);
const supportPath = path.join(
  root,
  "src/components/parari/settings/applicationManagerSupport.ts",
);

const source = fs.readFileSync(legacyPath, "utf8");

const startMarker = "const APPLICATION_TYPES: ApplicationType[] = [";
const endMarker = "export default function ApplicationManager({";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not locate ApplicationManager support block.");
}

let moved = source.slice(start, end).trimEnd();

moved = moved
  .replace(
    /^const APPLICATION_TYPES:/m,
    "export const APPLICATION_TYPES:",
  )
  .replace(
    /^const ACTION_LABEL_OPTIONS/m,
    "export const ACTION_LABEL_OPTIONS",
  )
  .replace(/^type /gm, "export type ")
  .replace(/^function /gm, "export function ");

const support = `import type {\n  ApplicationAcceptanceMode,\n  ApplicationDefinitionData,\n  ApplicationType,\n} from "@/components/parari/panels/application/applicationTypes";\n\n// Creator-side APPLICATION model/view helpers.\n// Keep formatting, CSV export, entry display helpers, and manager-only types\n// outside the React state machine so the main manager remains navigable.\n\n${moved}\n`;

const imports = `import {\n  ACTION_LABEL_OPTIONS,\n  APPLICATION_TYPES,\n  downloadApplicationEntriesCsv,\n  formatApplicationAnswerValue,\n  formatApplicationDateTime,\n  getApplicationEntryAnswerColumns,\n  getApplicationEntryAnswerValue,\n  getApplicationEntryApplicantName,\n  getApplicationEntryStatusLabel,\n  getDefaultAcceptanceMode,\n  getManagedApplicationOrigin,\n  getTitlePlaceholder,\n} from "./applicationManagerSupport";\nimport type {\n  ApplicationAccess,\n  ApplicationEntryStatus,\n  ApplicationEntryViewMode,\n  ApplicationManagerCreatedApplication,\n  ApplicationManagerProps,\n  ApplicationPaymentMethod,\n  ManagedApplication,\n  ManagedApplicationEntry,\n  ManagedCalendarItem,\n  ManagedForm,\n  ManagedMembership,\n} from "./applicationManagerSupport";\n\nexport type {\n  ApplicationManagerCreatedApplication,\n} from "./applicationManagerSupport";\n\n`;

const nextLegacy =
  source.slice(0, start) +
  imports +
  source.slice(end);

fs.writeFileSync(supportPath, support);
fs.writeFileSync(legacyPath, nextLegacy);

console.log("Extracted ApplicationManager support block.");
console.log(`Legacy: ${source.length} -> ${nextLegacy.length} chars`);
console.log(`Support: ${support.length} chars`);
