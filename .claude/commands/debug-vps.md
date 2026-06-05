---
description: Debug and hot-patch the production VPS (living, hosting livingdictionaries.app / new.livingdictionaries.app). Use when troubleshooting production server issues, deployment hiccups, or container state.
---

# Living Dictionaries VPS Debug

> **PRE-CUTOVER NOTE.** Until the `living` VPS is actually deployed
> (`future/deploy-new-site-to-living-vps.md`), most of these commands have
> nothing to talk to. Old prod still lives on Vercel + Supabase; this command
> documents the operational sequence for the new VPS once it's up.

## Infrastructure

| | Living (Hostinger) |
|---|---|
| **SSH alias** | `living` |
| **Domain** | `new.livingdictionaries.app` (will flip to apex `livingdictionaries.app` at cutover) |
| **Front door** | Cloudflare → VPS Caddy reverse-proxy → `sveltekit:3000` |
| **Container** | `sveltekit` (Node alpine, runs `node build`) |
| **Reverse proxy** | `caddy` container on the `web` Docker network |
| **VPS env** | `/opt/hosting/sveltekit/.env` (manually maintained — edit + `docker restart sveltekit`). Canonical contents documented in `.issues/cutover-runbook.md` "Environment" section. |
| **Repo on VPS** | `/opt/hosting/sveltekit/code/` (cloned via deploy webhook on push to the configured branch — currently `svelte-5-migration`, flips to `main` at cutover) |
| **Data volume** | `/opt/hosting/data` (host) ↔ `/workspace/site/.data` (container). `shared.db` + per-dict `dictionaries/<id>.db` files live here. |
| **Setup scripts** | `~/code/vps-setup` (Dockerfiles, Caddyfiles, env templates, deploy hooks, `setup/machines/living.conf`) |

## Common operations

```bash
# Logs (last 100 lines)
ssh living "docker logs sveltekit --tail 100 2>&1"

# Tail logs live
ssh living "docker logs -f sveltekit"

# Container state
ssh living "docker ps && docker stats --no-stream sveltekit"

# Restart (after env change)
ssh living "docker restart sveltekit"

# Restart Caddy (after Caddyfile edit)
ssh living "docker restart caddy"

# Caddyfile location + contents
ssh living "docker exec caddy cat /etc/caddy/Caddyfile"

# Inspect mounts + env vars on the live container
ssh living "docker inspect sveltekit | grep -A 3 Mounts"
ssh living "docker exec sveltekit env | grep -v SECRET | grep -v KEY"
```

## Deploy

Deploys auto-trigger on push to the configured branch via a GitHub webhook →
script in `~/code/vps-setup`. To check deploy status:

```bash
ssh living "tail -50 /var/log/deploy.log 2>&1 || journalctl -u deploy --since '1 hour ago' --no-pager"
```

To force a rebuild (e.g. after a Dockerfile change that should pick up new deps):

```bash
ssh living "cd /opt/hosting/sveltekit/code && git pull && docker compose up -d --build --force-recreate sveltekit"
```

## Hot-patch a file

For a quick fix that doesn't warrant a full deploy (debugging, log additions):

```bash
# Single file
scp some-file.js living:/tmp/some-file.js
ssh living "docker cp /tmp/some-file.js sveltekit:/workspace/site/build/<destination_path> && docker restart sveltekit"
```

Always revert via a real commit + deploy when done — hot-patches are wiped on the next normal deploy.

## Env var change

```bash
# Edit on VPS (no synced template — env file is hand-maintained)
ssh living "vi /opt/hosting/sveltekit/.env"
# Then restart so the container reloads
ssh living "docker restart sveltekit"
```

Canonical env contents (after cutover): see `.issues/cutover-runbook.md`
"Environment" section. When ADDING a new env var, also:
1. Add it to `site/.env*` (committed for non-secrets, `.local` for secrets) so dev / build picks it up.
2. Document it in the cutover runbook's Environment section.
3. Missing vars surface as runtime errors when the code path is hit (no boot-time validation).

## When something's wrong

1. **Logs first**: `docker logs sveltekit --tail 200`. Look for stack traces and migration errors.
2. **Migration crashes on boot.** `hooks.server.ts` force-applies migrations at module load — a failed migration crashes boot loudly. Check `migrations` table state via `prod-db.md`. Note LD has TWO migration buckets: `shared-migrations/` (for `shared.db`) and `dictionary-migrations/` (for each `dictionaries/<id>.db`). A bad dict-migration trips the boot sweep that bumps every dict to the latest `dict_db_schema_version`.
3. **Cloudflare cache** can mask deploys → `curl -I https://new.livingdictionaries.app/ | grep -i cf` to confirm fresh response.
4. **R2 snapshot builder issues** — the cron-driven builder writes per-dict `.db.gz` snapshots to R2 (`snapshots.livingdictionaries.app`). The kill switch is `R2_SNAPSHOT_BUILDER_ENABLED=false` in `.env` + restart. Manual fallback: `bin/build-all-snapshots.ts` (see cutover runbook).
5. **Email-in webhook 401s** usually mean `INTERNAL_INGEST_SECRET` on the VPS .env no longer matches the value the Cloudflare Worker sends. Both ends are hand-rotated — the secret lives in two places.
6. **SES sends failing** — outbound network test from container:
   ```bash
   ssh living "docker exec sveltekit sh -c 'wget -qO- --tries=1 --timeout=5 https://email.us-east-2.amazonaws.com 2>&1 | head -3'"
   ```

## Useful one-liners

```bash
# Disk usage on the VPS (per-dict DBs can grow — watch /opt/hosting/data/dictionaries/)
ssh living "df -h && du -sh /opt/hosting/data/* | sort -h"

# Count of per-dict DB files
ssh living "ls /opt/hosting/data/dictionaries/ 2>/dev/null | wc -l"

# Recent firewall denials
ssh living "ufw status verbose"
```

## Related commands

- `prod-db.md` — read/modify shared.db OR per-dict dictionaries/<id>.db (use this for any DB lookup or change).
- `backup-vps-db.md` — back up `shared.db` + all per-dict DBs to R2 before destructive ops or schema changes.
- `scan-and-fix-errors.md` — triage recent client-side errors logged to `client_logs` (pipeline is live; production rows exist once the VPS is deployed).
