---
description: Back up the production SQLite databases (`shared.db` + all per-dict `dictionaries/<id>.db`) from the living VPS to Cloudflare R2 using SQLite's online-backup API. Run before destructive ops or schema migrations.
---

# Back Up Living's Production DB to R2

Uses SQLite's **online backup API** (via better-sqlite3 inside the running primary
`sveltekit_blue` container) so backups are consistent with zero downtime — the app
keeps running while the backup happens.

## Canonical script (preferred)

`~/code/vps-setup/bin/backup-vps-db` now supports **`living`** alongside
`poly` / `shanding` / `house`, and runs daily via cron:

```bash
~/code/vps-setup/bin/backup-vps-db living    # or: all
```

It auto-resolves the **primary** blue/green container (`resolve_container()`
picks the `sveltekit*` container that lacks `IS_STANDBY` → blue), online-backs-up
`shared.db` + **every** per-dict `dictionaries/<id>.db` (staging at `/data/.backup-staging`),
tars + zstd's, and uploads to R2 — zero downtime. Use this; the ad-hoc procedure
below is only a fallback if the script is unavailable.

> **IMPORTANT — Per-dict DBs must be backed up too.** LD has TWO classes of DB
> on the VPS, unlike house's single shared.db: the admin `shared.db` AND a
> `dictionaries/<id>.db` for every dictionary. Both the canonical script and the
> ad-hoc procedure below back up both.

## Ad-hoc backup procedure (until vps-setup script is extended)

```bash
HOST=living
TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
STAGING_HOST=/opt/hosting/data/.backup-staging
STAGING_CONTAINER=/data/.backup-staging
TARBALL_HOST=/tmp/db-backup-${HOST}-${TIMESTAMP}.tar.zst
R2_KEY=r2/backup/sqlite/${HOST}/${TIMESTAMP}.tar.zst

# 1. Prepare staging dir (host path = container path via volume mount)
ssh "$HOST" "sudo rm -rf ${STAGING_HOST} && sudo mkdir -p ${STAGING_HOST}/dictionaries && sudo chmod -R 777 ${STAGING_HOST}"

# 2. Online-backup shared.db + every per-dict DB inside the container — produces
#    consistent snapshots even under heavy write load.
ssh "$HOST" "docker exec sveltekit_blue node -e \"
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');
  const dst_base = '${STAGING_CONTAINER}';

  async function backup_one(src_path, dst_path) {
    fs.mkdirSync(path.dirname(dst_path), { recursive: true });
    const src = new Database(src_path, { readonly: true });
    await src.backup(dst_path);
    src.close();
    console.log('staged: ' + dst_path);
  }

  (async () => {
    // shared.db
    await backup_one('/data/shared.db', dst_base + '/shared.db');

    // per-dict DBs
    const dicts_dir = '/data/dictionaries';
    if (fs.existsSync(dicts_dir)) {
      const files = fs.readdirSync(dicts_dir).filter(f => f.endsWith('.db'));
      for (const file of files)
        await backup_one(path.join(dicts_dir, file), dst_base + '/dictionaries/' + file);
      console.log('staged ' + files.length + ' per-dict DBs');
    }
  })().catch(err => { console.error(err); process.exit(1); });
\""

# 3. Tar + zstd on the VPS
ssh "$HOST" "sudo tar -C ${STAGING_HOST} -cf - . | sudo zstd -9 -o ${TARBALL_HOST} && sudo chown \$USER:\$USER ${TARBALL_HOST}"
SIZE=$(ssh "$HOST" "ls -lh ${TARBALL_HOST} | awk '{print \$5}'")
echo "  tarball on $HOST: $SIZE"

# 4. scp to local
scp "$HOST:${TARBALL_HOST}" /tmp/

# 5. Upload to R2 (assumes mcli configured with 'r2' alias and r2/backup bucket exists)
mcli cp /tmp/$(basename "${TARBALL_HOST}") "${R2_KEY}"

# 6. Clean up
ssh "$HOST" "sudo rm -rf ${STAGING_HOST} ${TARBALL_HOST}"
rm -f /tmp/$(basename "${TARBALL_HOST}")

echo "Backup complete: ${R2_KEY}"
```

Note: per-dict DBs can total several GB across 2,136 dictionaries (the biggest
single one is ~50k entries). zstd-9 on the tarball makes this manageable, but
expect minutes-to-tens-of-minutes for a full run.

## When to run

- **Before destructive ops** — manual schema change, bulk delete, account deletion, anything you can't easily reverse
- **Before deploys that touch DB code or migrations** — the migration runner is idempotent but a bad migration could lock you out (and worse, could affect every per-dict DB via the boot sweep)
- **Periodically** — read-only, no downtime; already scheduled via the canonical script's daily cron (`~/code/vps-setup/bin/backup-vps-db all`)

## Restore from a backup

```bash
# Download from R2 + extract
mcli cp r2/backup/sqlite/living/2026-06-01T02-30-00Z.tar.zst /tmp/restore.tar.zst
mkdir -p /tmp/restore && tar --use-compress-program='zstd -d' -xf /tmp/restore.tar.zst -C /tmp/restore
ls /tmp/restore/         # → shared.db, dictionaries/

# Push back to VPS (destructive — stop BOTH containers first; both hold the DB open under blue/green)
ssh living 'docker stop sveltekit_blue sveltekit_green'

# shared.db
scp /tmp/restore/shared.db living:/tmp/shared.db
ssh living 'sudo mv /tmp/shared.db /opt/hosting/data/shared.db && sudo rm -f /opt/hosting/data/shared.db-shm /opt/hosting/data/shared.db-wal'

# per-dict DBs (replace single dict OR entire dir as needed)
scp /tmp/restore/dictionaries/DICT_ID.db living:/tmp/DICT_ID.db
ssh living 'sudo mv /tmp/DICT_ID.db /opt/hosting/data/dictionaries/DICT_ID.db && sudo rm -f /opt/hosting/data/dictionaries/DICT_ID.db-shm /opt/hosting/data/dictionaries/DICT_ID.db-wal'

ssh living 'cd /opt/hosting/sveltekit && docker compose up -d'   # brings blue + green back up
```

The `.db-shm` / `.db-wal` files MUST be deleted on restore — SQLite recreates
them clean on first open of the restored `.db`. Skipping that step causes
corruption / lost writes from the restored snapshot.

After restoring a per-dict DB, also **trigger a fresh R2 snapshot** so editors
pull the restored content:
```bash
ssh living 'docker exec sveltekit_blue node /workspace/site/build/bin/build-all-snapshots.js --dict-id=DICT_ID'
```

## List existing backups

```bash
mcli ls r2/backup/sqlite/living/
```

## Dependencies

- **Local**: `mcli` (with `r2` alias + `r2/backup` bucket configured), `ssh`, `scp`, `zstd`
- **VPS**: `tar`, `zstd`, `docker exec` against the primary `sveltekit_blue` container

## Related

- **database** skill (`.claude/skills/database/SKILL.md`) — direct prod DB ops (always run this backup first for destructive changes)
- `debug-vps.md` — container / Caddy / deploy ops
