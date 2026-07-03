# Switch deploys from svelte-5-migration → main (post-cutover) — ✅ DONE 2026-07-03

Cutover complete; deploys, GitHub default branch, and all checkouts now run off `main`.

## What was done (in order)

1. ✅ Joined histories without force push: `git merge -s ours origin/main` on `svelte-5-migration`
   (`919496ad`, tree verified identical to ours — 0-line diff).
2. ✅ vps-setup: `living.conf` `DEPLOY_BRANCH=main` (commit `70a8743`), `bin/sync living` regenerated
   deploy.sh + hooks.json (verified on VPS: `refs/heads/main`, `BRANCH="main"`, webhook active).
3. ✅ Pushed `svelte-5-migration:main` → webhook fired correctly (svelte-5-migration push filtered out,
   main push triggered). **First deploy FAILED**: the VPS clone was `--single-branch`, so its fetch
   refspec only mapped `svelte-5-migration` and `origin/main` never materialized → `reset --hard
   origin/main` → "unknown revision". Fixed the deploy.sh template in vps-setup `bin/sync` (commit
   `f7666ca`) to fetch with an explicit refspec `+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH` —
   this makes DEPLOY_BRANCH flips work on ALL machines' single-branch clones. Re-synced, re-ran
   deploy.sh manually → clean blue/green swap, apex 200, `/healthz` 200.
4. ✅ GitHub default branch → `main` (Jacob did in UI). `main` not protected.
5. ✅ Local checkouts on `main`: tuf, mustang, and the VPS repo itself (`checkout -B main origin/main`
   + fetch refspec updated + `remote set-head origin main`). Old local branches deleted on tuf
   (svelte-5-migration) and mustang (dev, svelte-5-migration).
6. ✅ Doc updates (uncommitted at close): `AGENTS.md`, `.claude/commands/debug-vps.md`,
   `backup-vps-db.md`, `log-and-fix.md`, `.claude/skills/check-logs/SKILL.md`,
   `.claude/skills/database/SKILL.md` (pre-cutover notes removed), `.knowledge/index.md`.
7. Remote branches (`svelte-5-migration`, `dev`, etc.): Jacob handles GitHub-side deletion.

## Related fix landed alongside (committed in ea2eb744)
`site/src/lib/components/maps/mapbox/controls/CustomControl.svelte` — `onRemove()` was a no-op;
fixed by `el.remove()`.
