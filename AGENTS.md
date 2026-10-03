# PARARI repository workflow

Read `docs/parari/AI_CODE_GUARDRAILS.md` before implementation. Its SSOT and compatibility principles apply to product code.

## Source of truth and starting work

- GitHub `origin/main` is the source of truth for released code. Work SSOT remains the source of truth for each work's content; these are separate concerns.
- Start with `git fetch --prune origin`, `git status --short`, and `npm run repo:status`. Check existing PRs for overlapping work.
- Keep the local `main` checkout clean and update it with `git pull --ff-only`. Make changes on a task branch or isolated worktree starting at current `origin/main`.
- Preserve uncommitted or unpushed work before synchronizing. Do not overwrite unknown changes or repair old worktrees by deleting their files.
- Archived or recovered copies are references, not active deployment sources.

## Publishing and synchronization

- Prefer local commit and git push so local HEAD, remote branch HEAD and PR HEAD remain the same commit.
- If a GitHub API fallback creates the remote commit, fetch the branch and compare its tree with the verified local tree before aligning the isolated checkout to the remote commit. Never report synchronization based only on similar filenames or a successful API response.
- Publish through a PR to main. Production normally deploys from main through Vercel's Git integration. Use direct production deployments only when specifically requested.
- Before merging, check the PR head SHA, required checks and conflicts. After merging, fetch main and update the clean main checkout; record the merged SHA.
- Inspect Vercel's production deployment, its assigned production domains and `githubCommitSha`. Distinguish PR Preview success from production deployment success.
- Report the main SHA, PR/head SHA, production SHA and remaining local changes. If production is pending or mismatched, say so.

## Repository hygiene

- Use Git history for code recovery. Do not commit timestamped backup copies in `src` or generated `*.tsbuildinfo` files.
- Run `npm run check:repo-hygiene`, `npm run typecheck`, and `npm run build` for source cleanup. Disclose build-only placeholder environment variables.
- Do not treat an unlinked route or a file without a direct importer as unused. Check public URLs, dynamic use, scripts, compatibility and data before deletion.
- Review route/API cleanup separately from snapshot-file cleanup. Keep database migrations and dictionary source data until their lifecycle has been checked.
