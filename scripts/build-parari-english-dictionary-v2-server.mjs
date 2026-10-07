import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "data", "parari_english_dictionary_master_v2.csv");
const OUTPUT = path.join(
  ROOT,
  "src",
  "lib",
  "parari",
  "english",
  "parariEnglishDictionaryV2.server.generated.ts",
);

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function readCsv(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });
    return row;
  });
}

const rows = readCsv(INPUT);

const entries = rows.map((row) => ({
  word: row.word,
  lemma: row.lemma,
  pos: row.pos,
  formType: row.form_type,
  senseId: row.sense_id,
  meaningJa: row.meaning_ja,
  eikenLevel: row.eiken_level || null,
  eikenLevels: String(row.eiken_levels || "").split(";").filter(Boolean),
  level: row.level,
  importance: Number(row.importance || 1),
  entryKind: row.entry_kind || "word",
  source: row.source || "legacy",
  category: row.category || null,
}));

const output = `// AUTO-GENERATED from data/parari_english_dictionary_master_v2.csv
// Server-only dictionary payload. Do not edit by hand.
import "server-only";

export type ParariEnglishDictionaryV2ServerEntry = {
  word: string;
  lemma: string;
  pos: string;
  formType: string;
  senseId: string;
  meaningJa: string;
  eikenLevel: string | null;
  eikenLevels: string[];
  level: string;
  importance: number;
  entryKind: string;
  source: string;
  category: string | null;
};

export const PARARI_ENGLISH_DICTIONARY_V2_SERVER_ENTRIES: ParariEnglishDictionaryV2ServerEntry[] = ${JSON.stringify(entries)};
`;

fs.writeFileSync(OUTPUT, output, "utf8");
console.log(`Generated ${OUTPUT}`);
console.log(`Entries: ${entries.length}`);
