// scripts/check-repo-hygiene.cjs
// 2026-10-03 22:30 JST
// PART: Prevent committed source snapshots and build caches
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const forbidden = files.filter(filename =>
  (filename.startsWith("src/") && /(?:\.backup|\.tmp_backup)(?:[._-]|$)/i.test(path.basename(filename))) ||
  filename.endsWith(".tsbuildinfo")
);
if (forbidden.length) {
  console.error("Remove these snapshots/caches from tracked source; recover code through Git history:");
  console.error(forbidden.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS: no committed source backups or TypeScript build caches.");
}
