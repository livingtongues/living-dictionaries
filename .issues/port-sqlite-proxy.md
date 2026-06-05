# Port sqlite-proxy into LD site (Phase 1 admin shared.db + Phase 2 per-dict dict.db)

Dev-only HTTP+WS proxy that lets the agent CLI (`scripts/sqlite-query.sh`) run SQL against the
live wa-sqlite DB in the admin/editor's browser. Ported from house (which ported from tutor).
Decisions from the 2026-06-05 interview:

- **Q1 = composite client_id**: the 5 proxy files stay byte-identical to house (only ports differ).
  Admin registers as `<email>`; each open dict registers as `<email>::dict::<dict_id>`. All
  addressing smarts live in the browser `live_share` + the CLI's `--dict` flag.
- **Q2 = broadcast-writes**: `live_share` is write-aware. A write SQL (INSERT/UPDATE/DELETE) runs via
  `connection.execute()` instead of `.query()`. For dict connections that triggers the SharedWorker
  `tables_changed` broadcast → UI live-updates. For main-thread connections (LD admin, house, tutor)
  there's no broadcast, so `live_share` also calls a `notify(table)` callback = `live_db.notify_table`.
  **Port this write-awareness back to house + tutor too.**
- **Q3 = throwaway smoke test** (don't commit).

## Ports (LD)
Vite dev = 3041, prod (`vite dev --mode production`) falls back to 3042. Formula anchored at 3041:
`ws = 4050 + (vite-3041)*2`, `http = ws+1`. So dev → ws 4050 / http 4051; prod → ws 4052 / http 4053.
Clear of tutor (4000-range) + house (4020-range). Same formula in 3 places: `sqlite-proxy/vite-plugin.ts`,
`src/lib/db/client/live-share.svelte.ts`, `scripts/sqlite-query.sh` (KNOWN_PORTS = 4051 4053).

## Tasks
- [x] `site/sqlite-proxy/{connection-manager,http-server,websocket-server,servers,vite-plugin}.ts` (copy house, ports only)
- [x] `site/src/lib/db/client/live-share.svelte.ts` — multi-target, write-aware (reuse `extract_table_name` from dict-connection)
- [x] Wire `site/src/routes/admin/+layout.ts` — dev-only `live_share.register({ connection, client_id: email, notify })`
- [x] Wire `site/src/routes/[dictionaryId]/+layout.ts` — dev-only register `<email>::dict::<id>` (no notify; execute broadcasts)
- [x] `site/vite.config.ts` — register `sqlite_proxy()`
- [x] `scripts/sqlite-query.sh` — LD ports + composite client selection (`--dict X`, `--status`); chmod +x
- [x] deps: `ws@^8.21.0` + `@types/ws@^8.18.1` added to site devDependencies (lockfile reconciled — see Notes)
- [x] `.claude/skills/sqlite-query/SKILL.md` — LD shared.db + dict.db tables, `--dict` usage
- [x] house: `live-share.svelte.ts` write-aware + notify; `sync-context.ts` pass notify (check = 0 errors)
- [x] tutor: `live-share.svelte.ts` write-aware + notify; `routes/+layout.ts` pass notify (my error cleared)

## Verify — DONE (static + headless)
- [x] LD `build` exit 0; `node build` boots, `/`=200, `/admin`=307, `/login`=301 (no SSR 500s).
- [x] LD `check`: my files 0 errors (7 remaining = OTHER session's tsconfig WIP, not mine).
- [x] dict-connection tests pass (5/5) — `extract_table_name` write-detector intact.
- [x] house `check` 0 errors; tutor my error gone (1 remaining = graded-readers stories WIP, not mine).
- [x] Throwaway CLI smoke vs mock proxy: `--status` labels shared.db vs dict.db[demo]; default→admin client;
      `--dict demo`→composite client; `--dict missing`→clean error. (mock deleted)
- [ ] **NEEDS JACOB**: real end-to-end in the browser — dev on 3041, open `/admin/*` then run
      `scripts/sqlite-query.sh "SELECT count(*) FROM users"`; open a `/<dictionaryId>` then
      `scripts/sqlite-query.sh --dict <id> "SELECT count(*) FROM entries"`; and a dict UPDATE → watch the UI live-update.

## Gotcha discovered
- This LD tree has **concurrent uncommitted work from another session** (cf-worker/, kitbook removal,
  `tsconfig.json` + `vitest.config.ts` edits, `@vitest/ui` + 2 `check:*` scripts removed from package.json).
  My `pnpm add ws` reconciled the lockfile to match their already-edited package.json (pruned stale
  `@vitest/ui` from the lock) + added ws/@types/ws. Their tsconfig edit is what makes `check` show 7
  unrelated errors. Coordinate before committing so the streams don't collide.

## Tables (for the skill)
shared.db: client_logs, db_metadata, deletes, dictionaries, dictionary_partners, dictionary_roles,
email_aliases, email_codes, invites, message_attachments, messages, message_threads, migrations, users.
dict.db: audio, audio_speakers, db_metadata, deletes, dialects, entries, entry_dialects, entry_tags,
migrations, photos, sense_photos, senses, senses_in_sentences, sense_videos, sentence_photos, sentences,
sentence_videos, speakers, tags, texts, videos, video_speakers.

## Notes
- LD `live_share` imports `extract_table_name` from `dict-client/dict-connection` (returns table for
  INSERT/UPDATE/DELETE, null for SELECT → doubles as the write detector). house/tutor inline a small copy.
- `REPLACE INTO` (without INSERT) isn't matched → treated as read (harmless edge).
- Register dict inside the `if (!cached)` block so a full reload (globals reset) re-registers; soft HMR
  won't, matching house's admin behavior.
