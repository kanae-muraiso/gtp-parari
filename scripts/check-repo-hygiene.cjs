// scripts/check-repo-hygiene.cjs
// 2026-10-07 19:35 JST
// PART: Keep recoverable snapshots and local generated state out of the repository
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const forbidden = files.filter(filename =>
  filename.split("/").some(part => /(?:\.backup|\.tmp_backup)(?:[._-]|$)/i.test(part)) ||
  filename.endsWith(".tsbuildinfo") ||
  filename.startsWith("supabase/.temp/") ||
  (filename.startsWith("src/") && /\.deprecated\.[jt]sx?$/.test(filename))
);
if (forbidden.length) {
  console.error("Remove these snapshots/caches from tracked source; recover code through Git history:");
  console.error(forbidden.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS: no committed backups, deprecated source copies, or local build/CLI caches.");
}
