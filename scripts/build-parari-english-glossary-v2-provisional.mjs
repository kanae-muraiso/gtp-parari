// scripts/build-parari-english-glossary-v2-provisional.mjs
// 2026-06-17 JST
// PART: build v2 provisional glossary without permanently touching v0 master or default generated file

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT_DIR = process.cwd();

const V0_MASTER_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v0.csv",
);

const V2_PROVISIONAL_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_provisional.csv",
);

const DEFAULT_GENERATED_PATH = path.join(
  ROOT_DIR,
  "src",
  "lib",
  "parari",
  "english",
  "parariEnglishGlossary.generated.ts",
);

const V2_GENERATED_PATH = path.join(
  ROOT_DIR,
  "src",
  "lib",
  "parari",
  "english",
  "parariEnglishGlossary.v2Provisional.generated.ts",
);

const BUILD_SCRIPT_PATH = path.join(
  ROOT_DIR,
  "scripts",
  "build-parari-english-glossary.mjs",
);

const TMP_V0_MASTER_BACKUP_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v0.tmp_backup_for_v2_build.csv",
);

const TMP_GENERATED_BACKUP_PATH = path.join(
  ROOT_DIR,
  "src",
  "lib",
  "parari",
  "english",
  "parariEnglishGlossary.generated.tmp_backup_for_v2_build.ts",
);

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function copyFile(from, to) {
  fs.copyFileSync(from, to);
}

function cleanupTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}

assertFileExists(V0_MASTER_PATH);
assertFileExists(V2_PROVISIONAL_PATH);
assertFileExists(DEFAULT_GENERATED_PATH);
assertFileExists(BUILD_SCRIPT_PATH);

console.log("PARARI English glossary v2 provisional build started.");

try {
  // 1. backup current v0 master and default generated file
  copyFile(V0_MASTER_PATH, TMP_V0_MASTER_BACKUP_PATH);
  copyFile(DEFAULT_GENERATED_PATH, TMP_GENERATED_BACKUP_PATH);

  // 2. temporarily use v2 provisional as the master input expected by existing build script
  copyFile(V2_PROVISIONAL_PATH, V0_MASTER_PATH);

  // 3. run existing builder
  execFileSync("node", [BUILD_SCRIPT_PATH], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  // 4. save generated result as v2-specific generated file
  copyFile(DEFAULT_GENERATED_PATH, V2_GENERATED_PATH);

  console.log(`\nWrote v2 provisional generated file: ${V2_GENERATED_PATH}`);
} finally {
  // 5. restore v0 master and default generated file even if build fails
  if (fs.existsSync(TMP_V0_MASTER_BACKUP_PATH)) {
    copyFile(TMP_V0_MASTER_BACKUP_PATH, V0_MASTER_PATH);
  }

  if (fs.existsSync(TMP_GENERATED_BACKUP_PATH)) {
    copyFile(TMP_GENERATED_BACKUP_PATH, DEFAULT_GENERATED_PATH);
  }

  cleanupTempFile(TMP_V0_MASTER_BACKUP_PATH);
  cleanupTempFile(TMP_GENERATED_BACKUP_PATH);

  console.log("Restored v0 master and default generated file.");
}

console.log("PARARI English glossary v2 provisional build finished.");
