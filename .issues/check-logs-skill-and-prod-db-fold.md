# Add a `check-logs` skill + fold `prod-db` command into the `database` skill

**Why:** The agent has rich log/DB *commands* but they only fire when Jacob types the slash
command. When he just says "debug this error," nothing auto-surfaces the capability. **Skills**
auto-load by description, so the fix is to make these skills, not commands.

## Decisions (from interview)
- **Q2 surfaces:** structured `client_logs` only; one-line `debug-vps` pointer at the bottom for
  Docker/Caddy.
- **Shape:** convert `scan-and-fix-errors.md` → a `check-logs` **skill** (focused on getting INTO
  the logs, not prescribing investigate-vs-fix). Delete the command.
- **prod-db:** fold the valuable (simplified) parts into the **database** skill; update the database
  skill's description to cover reading/querying live + prod data; delete the command.
- **Q4 scope:** LD only now; offer to port to house + tutor after.
- **Q5 dead link:** repoint the `.knowledge/architecture/client-logs.md` refs (no new page) → the
  check-logs skill now carries the pipeline + schema reference.

## Key facts
- **Authoritative prod container DB path = `/data/shared.db`** (DATA_DIR=/data, mount
  `/opt/hosting/data:/data`). `prod-db.md`'s `/workspace/site/.data/...` is STALE (already noted in
  `.issues/logging-buildout.md:75`; vps-setup fixed the same in backup-vps-db). Use `/data/...`.
- Dev DB path: `site/.data/shared.db`.
- `client_logs` holds BOTH browser logs (`source='client'`) and server telemetry
  (`source='server'`, via `log_server_event`). Excluded from sync.

## Tasks
- ✅ Create `.claude/skills/check-logs/SKILL.md` (from scan-and-fix-errors, reframed) — dev one-liner live-tested
- ✅ Delete `.claude/commands/scan-and-fix-errors.md`
- ✅ Add "Querying / modifying the production VPS DBs" section to `.claude/skills/database/SKILL.md` +
      update its description + fix the internal pointer
- ✅ Delete `.claude/commands/prod-db.md`
- ✅ Repoint references: `debug-vps.md`, `backup-vps-db.md`, `log-and-fix.md`, `sqlite-query` skill,
      `.issues/logging-buildout.md:75` (resolved). Left `.cron/log-reviews/2026-06-25.md` (history).
- ✅ Verify: no remaining refs to the deleted commands (grep clean except this issue)

## Discovered + fixed along the way (blue/green container bug)
The commands predate the **2026-06-24 blue/green rollout**. Prod runs **`sveltekit_blue`** (primary,
:3001) + `sveltekit_green` (standby, :3002) — **no plain `sveltekit` container** → every
`docker exec sveltekit` was broken against prod. Verified live: `sveltekit_blue` has `/data/shared.db`
(500 client_logs rows). Both share the `/data` mount, so either works for read-only queries.
- ✅ Fixed in the new **check-logs** + **database** skills (use `sveltekit_blue` + blue/green note;
  schema-change rule now stops BOTH containers).
- ✅ Fixed the one `docker exec -i sveltekit` in `log-and-fix.md`.

## Follow-up (need Jacob's go-ahead — MEDIUM, not a blind rename)
- **`debug-vps.md` (10 refs) + `backup-vps-db.md` (5 refs)** still say bare `sveltekit`. These mix
  container *lifecycle* ops (`restart`/`stop`/`start`/`inspect`/`logs -f`) where blue/green changes
  the right move (a deploy recreates both; you rarely hand-restart one). `backup-vps-db.md` also
  overlaps vps-setup's canonical `bin/backup-vps-db` (itself mid-update for blue/green). Wants a
  proper blue/green-aware pass, not s/sveltekit/sveltekit_blue/.
- Offer to port `check-logs` (+ the prod-DB database-skill section) to house + tutor (near-identical
  client_logs infra; both also on blue/green now).
