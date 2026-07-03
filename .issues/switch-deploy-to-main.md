# Switch deploys from svelte-5-migration → main (post-cutover)

Cutover is complete (www live, 2026-07) but everything still runs off `svelte-5-migration`:

- **vps-setup** `setup/machines/living.conf` has `DEPLOY_BRANCH=svelte-5-migration` — this single
  var generates BOTH the VPS `deploy.sh` (clone/fetch+`reset --hard origin/$BRANCH`) and
  `hooks.json` (webhook branch filter `refs/heads/svelte-5-migration`). The GitHub webhook itself
  sends ALL pushes; filtering is server-side, so no GitHub webhook change is needed.
- **GitHub default branch is `dev`** — stale since 2026-03 (tip is issue-sync automation commits).
- `main` is ancient: 2581 commits behind svelte-5-migration, 1 unique commit (`0b828785` "Update
  constants (#646)", pre-migration). Diverged — NOT fast-forwardable.
- `dev`'s 9 unique commits: GitHub issue-sync workflow noise + "New dictionary variant (#631)" —
  the variant feature already exists in the new schema (`dictionary.ts` `variant` column), so
  nothing valuable is stranded there.

## Plan (order matters)

1. ⬜ In living-dictionaries, join histories without a force push:
   `git checkout svelte-5-migration && git merge -s ours origin/main -m "Absorb old main — superseded by the SQLite/VPS rewrite"`
   then `git push origin svelte-5-migration` (webhook still watches this branch → one last normal deploy).
2. ⬜ Flip vps-setup: `living.conf` `DEPLOY_BRANCH=main`, commit, run `bin/sync living`
   (regenerates deploy.sh + hooks.json, restarts webhook; missing `secrets-decrypted/` files are
   SKIPped gracefully so this is safe from mustang — verify SSH to living works from here).
3. ⬜ `git push origin svelte-5-migration:main` → webhook (now watching main) fires → verify the
   deploy log on the living VPS shows a clone/reset onto `origin/main` and containers swap.
   ⚠ If `main` has branch protection, this push fails — Jacob relaxes it in repo settings first.
4. ⬜ Set GitHub default branch `dev` → `main` (repo admin: Jacob in UI, or gh from tuf — gh is
   not installed on mustang).
5. ⬜ Local checkouts: switch to `main` for future work.
6. ⬜ Doc updates in LD repo: `AGENTS.md` ("committed on and deployed from svelte-5-migration until
   cutover" line), `.claude/commands/debug-vps.md` (branch note), `.claude/skills/check-logs/SKILL.md`
   (pre-cutover note), `.knowledge/index.md` title, `.cron/invoice-2026-07-24.md` mentions both
   branches (fine, leave).
7. ⬜ Decide fate of `svelte-5-migration` + `dev` branches (keep frozen a while vs delete).

## Open questions (asked 2026-07-03)
- Merge strategy confirmation (`-s ours` merge vs force-push main).
- Who flips the GitHub default branch / handles possible main branch protection.
- Delete or keep the old branches.

## Related fix landed alongside (uncommitted)
`site/src/lib/components/maps/mapbox/controls/CustomControl.svelte` — `onRemove()` was a no-op;
mapbox moves the control element out of Svelte's anchor range so neither mapbox nor Svelte teardown
ever detached it → "Toggle Private" stayed on the home map while previewing as Visitor. Fixed by
`el.remove()` in `onRemove`. Verified headless (login → preview Visitor → button gone → exit →
button back, no page errors); dev Mapbox token is dummy so the e2e intercepts the style request
with a blank style to get the map's `load` event (script was at /tmp/verify-toggle-private.mjs).
