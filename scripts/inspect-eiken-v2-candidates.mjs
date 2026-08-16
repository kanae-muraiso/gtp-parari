// scripts/inspect-eiken-v2-candidates.mjs
// 2026-06-17 JST
// PART: inspect PARARI English v2 candidate CSV files safely

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const WORD_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates.csv",
);

const PHRASE_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_phrase_candidates.csv",
);

const CONVERSATION_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_conversation_candidates.csv",
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
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");

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

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key] || "(blank)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => {
    const order = ["5", "4", "3", "pre2", "2", "pre1", "1", "junior_high", "high_school", "exam"];
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);

    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }

    return String(a[0]).localeCompare(String(b[0]));
  });
}

function printCounts(title, rows) {
  console.log(`\n## ${title}`);
  console.log(`rows: ${rows.length}`);

  console.log("\nmin_eiken_level:");
  for (const [key, count] of countBy(rows, "min_eiken_level")) {
    console.log(`  ${key}: ${count}`);
  }

  console.log("\nparari_level:");
  for (const [key, count] of countBy(rows, "parari_level")) {
    console.log(`  ${key}: ${count}`);
  }

  console.log("\nimportance:");
  for (const [key, count] of countBy(rows, "importance")) {
    console.log(`  ${key}: ${count}`);
  }
}

const wordRows = readCsv(WORD_PATH);
const phraseRows = readCsv(PHRASE_PATH);
const conversationRows = readCsv(CONVERSATION_PATH);

printCounts("word candidates", wordRows);
printCounts("phrase candidates", phraseRows);
printCounts("conversation candidates", conversationRows);
