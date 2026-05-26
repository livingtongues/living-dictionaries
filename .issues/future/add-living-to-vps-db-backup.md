# Add `living` to `backup-vps-db`

Once the new living-dictionaries SvelteKit/SQLite site is deployed to the living VPS (see `future/deploy-new-site-to-living-vps.md`) and is writing its own `shared.db` / per-user DBs under `/opt/hosting/data/`, hook it into the existing backup tooling at `~/code/vps-setup/bin/backup-vps-db`.

## Prereqs
- [ ] `future/deploy-new-site-to-living-vps.md` is done — the `sveltekit` container is running on the `living` VPS with the standard volume mount `/opt/hosting/data:/workspace/site/.data` (same convention tutor + house use).
- [ ] Site is actually persisting data the user cares about (shared.db rows, eventually `users/{id}.db` files for pglite-synced dictionaries).

## Work
- [ ] Edit `~/code/vps-setup/bin/backup-vps-db`:
  - Add `living` to the TARGET validation list.
  - Add `living)    backup_one living ;;` case.
  - Add `living` to the `all)` aggregate so the default cron run includes it: `all) backup_one poly; echo; backup_one shanding; echo; backup_one house; echo; backup_one living ;;`.
  - Update the usage line + top-of-file comment to list `living` alongside the others.
- [ ] Smoke-test: `backup-vps-db living` — should land a tarball at `r2/backup/sqlite/living/<timestamp>.tar.zst` containing `shared.db` (and `users/*.db` once those exist).
- [ ] Confirm the cron schedule that calls `backup-vps-db` (without a target arg) picks up `living` automatically once the script's default `all` includes it.

## Notes
- The `backup_one()` helper is host-agnostic: it SSHs into `$host`, runs the SQLite online-backup API inside the `sveltekit` container, tars the staging dir, scp's locally, and uploads to R2. As long as `living` VPS matches the convention (`sveltekit` container name, `/opt/hosting/data` host path, `/workspace/site/.data` container path), no helper changes are needed.
- Reference: `house` was added the same way on 2026-05-25 (see house's `.issues/port-customer-site-from-old.md` 3D).
