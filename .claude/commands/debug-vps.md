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
| **Front door** | Cloudflare → VPS Caddy (`lb_policy first` + `/healthz` active checks) → `sveltekit_blue:3000` (primary) / `sveltekit_green:3000` (standby) |
| **Containers** | **Blue/green** (since 2026-06-24): `sveltekit_blue` (primary, host :3001) + `sveltekit_green` (standby, host :3002, `IS_STANDBY=true` → runs no singleton crons). Node alpine, shared image `sveltekit-app:current`, run `node build`. **No plain `sveltekit` container** — use `sveltekit_blue` for any exec/logs. |
| **Reverse proxy** | `caddy` container on the `web` Docker network |
| **Compose project** | `/opt/hosting/sveltekit` (holds `docker-compose.yml` + the generated `deploy.sh`) |
| **VPS env** | `/opt/hosting/sveltekit/.env` (manually maintained — edit + recreate BOTH containers, see "Env var change"). Canonical contents documented in `.issues/cutover-runbook.md` "Environment" section. |
| **Repo on VPS** | `/opt/hosting/sveltekit/code/` (cloned via deploy webhook on push to the configured branch — currently `svelte-5-migration`, flips to `main` at cutover) |
| **Data volume** | `/opt/hosting/data` (host) ↔ `/data` (container, `DATA_DIR=/data`) — both containers mount it. `shared.db` + per-dict `dictionaries/<id>.db` files live here. |
| **Setup scripts** | `~/code/vps-setup` (Dockerfiles, Caddyfiles, env templates, deploy hooks, `setup/machines/living.conf`) |

## Common operations

```bash
# Logs (last 100 lines) — blue is primary; also check green when diagnosing the standby
ssh living "docker logs sveltekit_blue --tail 100 2>&1"

# Tail logs live
ssh living "docker logs -f sveltekit_blue"

# Container state (both halves of the blue/green pair)
ssh living "docker ps && docker stats --no-stream sveltekit_blue sveltekit_green"

# Restart Caddy (after Caddyfile edit)
ssh living "docker restart caddy"

# Caddyfile location + contents
ssh living "docker exec caddy cat /etc/caddy/Caddyfile"

# Inspect mounts + env vars on the primary container
ssh living "docker inspect sveltekit_blue | grep -A 3 Mounts"
ssh living "docker exec sveltekit_blue env | grep -v SECRET | grep -v KEY"
```

> **Restarting after an env or config change isn't a plain `docker restart`** — under blue/green you
> recreate both containers so they re-read the env_file (see "Env var change"). A `docker restart`
> reuses the env captured at create time.

## Deploy

Deploys auto-trigger on push to the configured branch via a GitHub webhook →
script in `~/code/vps-setup`. To check deploy status:

```bash
ssh living "tail -50 /var/log/deploy.log 2>&1 || journalctl -u deploy --since '1 hour ago' --no-pager"
```

To force a rebuild + zero-downtime swap manually (equivalent to a push — the generated `deploy.sh`
pulls, builds the shared image, then recreates **green first** (gated on `/healthz`) and **blue
second** so traffic always has a healthy target):

```bash
ssh living "/opt/hosting/sveltekit/deploy.sh"
```

## Hot-patch a file

For a quick fix that doesn't warrant a full deploy (debugging, log additions):

Patch **both** containers (Caddy can fail traffic over to green) then restart both:

```bash
scp some-file.js living:/tmp/some-file.js
ssh living "for c in sveltekit_blue sveltekit_green; do docker cp /tmp/some-file.js \$c:/workspace/site/build/<destination_path>; docker restart \$c; done"
```

Always revert via a real commit + deploy when done — hot-patches are wiped on the next normal deploy.

## Env var change

```bash
# Edit on VPS (no synced template — env file is hand-maintained)
ssh living "vi /opt/hosting/sveltekit/.env"
# Recreate BOTH containers so they re-read the env_file (a plain restart won't).
# green first to keep traffic served, blue second:
ssh living "cd /opt/hosting/sveltekit && docker compose up -d --force-recreate sveltekit_green && docker compose up -d --force-recreate sveltekit_blue"
```

Canonical env contents (after cutover): see `.issues/cutover-runbook.md`
"Environment" section. When ADDING a new env var, also:
1. Add it to `site/.env*` (committed for non-secrets, `.local` for secrets) so dev / build picks it up.
2. Document it in the cutover runbook's Environment section.
3. Missing vars surface as runtime errors when the code path is hit (no boot-time validation).

## When something's wrong

1. **Logs first**: `docker logs sveltekit_blue --tail 200`. Look for stack traces and migration errors.
2. **Migration crashes on boot.** `hooks.server.ts` force-applies migrations at module load — a failed migration crashes boot loudly. Check `migrations` table state via the **database** skill's production-VPS section. Note LD has TWO migration buckets: `shared-migrations/` (for `shared.db`) and `dictionary-migrations/` (for each `dictionaries/<id>.db`). A bad dict-migration trips the boot sweep that bumps every dict to the latest `dict_db_schema_version`.
3. **Cloudflare cache** can mask deploys → `curl -I https://new.livingdictionaries.app/ | grep -i cf` to confirm fresh response.
4. **R2 snapshot builder issues** — the cron-driven builder writes per-dict `.db.gz` snapshots to R2 (`snapshots.livingdictionaries.app`). The kill switch is `R2_SNAPSHOT_BUILDER_ENABLED=false` in `.env` + restart. Manual fallback: `bin/build-all-snapshots.ts` (see cutover runbook).
5. **Email-in webhook 401s** usually mean `INTERNAL_INGEST_SECRET` on the VPS .env no longer matches the value the Cloudflare Worker sends. Both ends are hand-rotated — the secret lives in two places.
6. **SES sends failing** — outbound network test from container:
   ```bash
   ssh living "docker exec sveltekit_blue sh -c 'wget -qO- --tries=1 --timeout=5 https://email.us-east-2.amazonaws.com 2>&1 | head -3'"
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

- **database** skill (`.claude/skills/database/SKILL.md`) — read/modify shared.db OR per-dict dictionaries/<id>.db (use for any DB lookup or change); see its "Querying / modifying the production VPS DBs" section.
- `backup-vps-db.md` — back up `shared.db` + all per-dict DBs to R2 before destructive ops or schema changes.
- **check-logs** skill (`.claude/skills/check-logs/SKILL.md`) — triage client-side errors logged to `client_logs` (pipeline is live; production rows exist once the VPS is deployed).
