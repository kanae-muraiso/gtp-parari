import fs from "node:fs";
import path from "node:path";

const filePath = path.join(
  process.cwd(),
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
);

let source = fs.readFileSync(filePath, "utf8");

source = source.replace(
  'import ApplicationEntryMessagePanel from "@/components/parari/application/ApplicationEntryMessagePanel";\n\n',
  "",
);

const participantsImport =
  'import ParticipantsPanel from "@/components/parari/manage/ParticipantsPanel";\n';

if (!source.includes(participantsImport)) {
  throw new Error("ParticipantsPanel import not found.");
}

source = source.replace(
  participantsImport,
  `${participantsImport}import ApplicationEntriesPanel from "./ApplicationEntriesPanel";\n`,
);

const startMarker = `                      {applicationOrigin ===\n                        "manual" &&\n                      openEntriesApplicationId ===\n                        application.id\n                        ? (() => {`;

const endMarker = `                        : null}\n                    </div>`;

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("Manual application entries JSX block not found.");
}

const replacement = `                      {applicationOrigin ===\n                        "manual" &&\n                      openEntriesApplicationId ===\n                        application.id ? (\n                        <ApplicationEntriesPanel\n                          application={application}\n                          entries={\n                            entriesByApplicationId[\n                              application.id\n                            ] ?? []\n                          }\n                          isLoaded={\n                            Boolean(\n                              entriesByApplicationId[\n                                application.id\n                              ],\n                            )\n                          }\n                          isLoading={\n                            entriesLoadingApplicationId ===\n                            application.id\n                          }\n                          message={entriesMessage}\n                          viewMode={entriesViewMode}\n                          onViewModeChange={\n                            setEntriesViewMode\n                          }\n                          openMessageEntryId={\n                            openMessageEntryId\n                          }\n                          openMessageApplicantName={\n                            openMessageApplicantName\n                          }\n                          entryActionId={\n                            entryActionId\n                          }\n                          onOpenMessage={(\n                            entryId,\n                            applicantName,\n                          ) => {\n                            setOpenMessageEntryId(\n                              entryId,\n                            );\n                            setOpenMessageApplicantName(\n                              applicantName,\n                            );\n                          }}\n                          onCloseMessage={() => {\n                            setOpenMessageEntryId(\n                              null,\n                            );\n                            setOpenMessageApplicantName(\n                              "",\n                            );\n                          }}\n                          onEntryAction={(\n                            entryId,\n                            action,\n                          ) =>\n                            updateApplicationEntryAction(\n                              application.id,\n                              entryId,\n                              action,\n                            )\n                          }\n                        />\n                      ) : null}\n`;

source =
  source.slice(0, start) +
  replacement +
  source.slice(end + '                        : null}\n'.length);

fs.writeFileSync(filePath, source);
console.log("Extracted manual APPLICATION entries UI.");
