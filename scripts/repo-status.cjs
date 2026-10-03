// scripts/repo-status.cjs
// 2026-10-03 22:30 JST
// PART: Repository state report
// Read-only report of local Git refs; fetch origin before using it.
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function git(arguments_, optional = false) {
  try {
    return execFileSync("git", arguments_, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (optional) return null;
    throw new Error(`git ${arguments_.join(" ")} failed: ${error.stderr?.toString().trim() || error.message}`);
  }
}
try {
  const branch = git(["symbolic-ref", "--short", "HEAD"], true);
  const head = git(["rev-parse", "HEAD"]);
  const main = git(["rev-parse", "refs/remotes/origin/main"]);
  const remoteBranch = branch ? git(["rev-parse", "--verify", `refs/remotes/origin/${branch}`], true) : null;
  const changes = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  const [mainOnly, localOnly] = git(["rev-list", "--left-right", "--count", `${main}...HEAD`]).split(/\s+/).map(Number);
  const productionIndex = args.indexOf("--production-sha");
  const production = productionIndex === -1 ? null : args[productionIndex + 1];
  if (productionIndex !== -1 && !/^[a-f0-9]{40}$/i.test(production || "")) {
    throw new Error("--production-sha requires a full commit SHA from Vercel production metadata");
  }
  const clean = !changes;
  const checkPassed = clean && mainOnly === 0 && (head === main || head === remoteBranch);
  const report = {
    branch: branch || "(detached)",
    localHead: head,
    originMain: main,
    originBranch: remoteBranch,
    clean,
    mainOnlyCommits: mainOnly,
    localOnlyCommits: localOnly,
    productionShaProvided: production,
    productionMatchesMain: production ? production === main : null,
    checkPassed,
    changes: changes ? changes.split("\n") : [],
    note: "Refs are local observations. Run git fetch --prune origin first. Production SHA is optional caller-supplied Vercel metadata, not an automatic deployment check.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (args.includes("--check") && (!checkPassed || (production && production !== main))) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
