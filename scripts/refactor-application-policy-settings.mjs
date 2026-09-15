import fs from "node:fs";
import path from "node:path";

const filePath = path.join(
  process.cwd(),
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
);

let source = fs.readFileSync(filePath, "utf8");

const participantsImport =
  'import ApplicationEntriesPanel from "./ApplicationEntriesPanel";\n';

if (!source.includes(participantsImport)) {
  throw new Error("ApplicationEntriesPanel import not found.");
}

source = source.replace(
  participantsImport,
  `${participantsImport}import ApplicationPolicySettings from "./ApplicationPolicySettings";\n`,
);

const templatesStart = source.indexOf(
  "  const AGREEMENT_TEMPLATES = {",
);
const agreementStateMarker = `  const [\n    agreement,\n    setAgreement,\n  ] = React.useState(\"\");`;
const agreementStateStart = source.indexOf(
  agreementStateMarker,
  templatesStart,
);

if (templatesStart < 0 || agreementStateStart < 0) {
  throw new Error("Agreement template block not found.");
}

source =
  source.slice(0, templatesStart) +
  source.slice(agreementStateStart);

const presetStart = source.indexOf(
  "\n\n  const agreementPreset =",
);
const actionLabelMarker = `\n\n  const [\n    actionLabel,\n    setActionLabel,\n  ] = React.useState(\"\");`;
const actionLabelStart = source.indexOf(
  actionLabelMarker,
  presetStart,
);

if (presetStart < 0 || actionLabelStart < 0) {
  throw new Error("Agreement preset calculation not found.");
}

source =
  source.slice(0, presetStart) +
  source.slice(actionLabelStart);

const policyStartMarker = `            <div className="mt-5 rounded-2xl border border-neutral-200 p-5">\n                        <div className="text-sm font-bold text-neutral-950">\n                          支払`;
const policyEndMarker = `\n\n            {statusMessage ? (`;

const policyStart = source.indexOf(policyStartMarker);
const policyEnd = source.indexOf(
  policyEndMarker,
  policyStart,
);

if (policyStart < 0 || policyEnd < 0) {
  throw new Error("APPLICATION policy settings JSX block not found.");
}

const replacement = `            <ApplicationPolicySettings\n              canUseExtendedApplication={\n                canUseExtendedApplication\n              }\n              paymentMethod={paymentMethod}\n              onPaymentMethodChange={\n                setPaymentMethod\n              }\n              paymentAmount={paymentAmount}\n              onPaymentAmountChange={\n                setPaymentAmount\n              }\n              paymentUrl={paymentUrl}\n              onPaymentUrlChange={\n                setPaymentUrl\n              }\n              paymentInstructions={\n                paymentInstructions\n              }\n              onPaymentInstructionsChange={\n                setPaymentInstructions\n              }\n              paymentConfirmationRequired={\n                paymentConfirmationRequired\n              }\n              onPaymentConfirmationRequiredChange={\n                setPaymentConfirmationRequired\n              }\n              agreement={agreement}\n              onAgreementChange={setAgreement}\n              acceptanceMode={acceptanceMode}\n              onAcceptanceModeChange={\n                setAcceptanceMode\n              }\n              actionLabelPreset={\n                actionLabelPreset\n              }\n              onActionLabelPresetChange={\n                setActionLabelPreset\n              }\n              actionLabel={actionLabel}\n              onActionLabelChange={\n                setActionLabel\n              }\n            />`;

source =
  source.slice(0, policyStart) +
  replacement +
  source.slice(policyEnd);

fs.writeFileSync(filePath, source);
console.log("Extracted APPLICATION policy settings UI.");
