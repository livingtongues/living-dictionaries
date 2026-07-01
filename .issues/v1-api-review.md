# /api/v1 API review — holes, texts gap, reader story

Review of the agent-facing `/api/v1/*` write API + API-key auth. Requested focus:
(1) general holes/inconsistencies/security, (2) sentences **and texts** must be
thoroughly enter-able by agents, (3) the **read-key / reader story** must be
comprehensive (we've only exercised write keys so far).

## Map of what exists
- Auth: `verify_dict_api_access` (ldk_ key OR session) → `load_v1_dictionary_context`.
  Key crypto in `lib/api-keys/api-key.ts`; table `shared-migrations/20260629_api_keys.sql`.
- Writes flow through `merge_dict_row` / `delete_dict_row` (same path as browser push)
  via `lib/db/server/v1-entry-write.ts`, `v1-sub-resources.ts`, `v1-sources.ts`.
- Endpoints: dictionaries/[id] (GET), entries (GET list, POST bulk),
  entries/[entryId] (GET/PATCH/DELETE), sentences/[id] (PATCH/DELETE),
  senses/[id] (DELETE), speakers (GET/POST), tags (GET/POST), tags/[id] (PATCH/DELETE),
  dialects (GET/POST), dialects/[id] (PATCH/DELETE), sources (GET/POST),
  sources/[id] (PATCH/DELETE), entries/[id]/tags|dialects/[id] (DELETE unlink),
  openapi.json.

## Strengths (keep)
- API-key model is solid: 256-bit random, sha256-at-rest, prefix+last4 display,
  dict-scoped, role-scoped, revoke-not-delete (history attribution), immediate
  revocation via fresh DB lookup. Keys can't escalate (manager actions are session-only;
  wrong dict → 403).
- Writes are indistinguishable from human edits (history + api_key_id attribution + sync).
- Per-item SAVEPOINT best-effort batching with correct history buffering on rollback.
- Good agent docs (openapi.ts + /api/v1 landing).

## FINDINGS

### HIGH
1. **Texts are entirely missing from the write API.** `texts` table exists (title
   MultiString) and `sentences.text_id / sort_key / ends_paragraph` + audio/video
   `text_id` all exist, but there is NO texts endpoint and NO way to create an ordered
   text-sentence. `example_sentences` created via the API always land with
   `text_id=NULL, sort_key=NULL`. openapi documents text_id/sort_key/ends_paragraph as
   read-only. → Agents cannot enter story/connected-text data at all. This is the #1
   requested gap.
2. **Body-size limit mismatch.** adapter-node defaults `BODY_SIZE_LIMIT=512K` and it's
   not overridden (Dockerfile/compose/.env). Docs tell agents to batch ≤1000 entries,
   which will routinely exceed 512K → 413. Fix: set BODY_SIZE_LIMIT (e.g. 8–16M) in the
   VPS env, OR lower the documented cap and add a clear 413 hint.
3. **No server-side idempotency.** POST /entries always creates. A network timeout after
   commit → silent duplicate on retry. Documented "keep a local ledger" mitigates for
   well-behaved agents but there's no server key (Idempotency-Key or dedupe on external_id).

### MEDIUM
4. **Reader story is thin.** Read keys DO work (read→contributor rank; writes 403 with a
   clear message). But the read surface is minimal:
   - `GET /entries` returns only lexeme/phonetic/elicitation_id/updated_at — NO glosses/
     senses. A reader must N+1 `GET /entries/{id}` to get meaning content.
   - No texts read, no sentences list, no bulk export.
   - Private content is ALWAYS exposed to any key (`build_entry_data` hard-codes
     `admin_level: 1`), including `private` tags. No "public-only" read key variant.
5. **Event-loop blocking.** better-sqlite3 is synchronous; a 1000-entry bulk write holds
   the Node event loop for the whole transaction → head-of-line blocking for ALL requests
   (every dict) for its duration. Consider a lower practical cap or chunked yielding.
6. **Test gaps.** Untested v1 endpoints: sources (GET/POST) + sources/[id] (the most
   complex: 409 conflict, remove_from_all cascade), speakers, tags (POST/GET),
   dialects (POST/GET).
7. **Input validation gaps.** speaker `gender` not constrained to m/f/o; `decade` not
   validated numeric. Per-entry nested size unbounded (only entry COUNT is capped).

### LOW / nits
8. Inconsistent telemetry: entries/sources log_server_event; speakers/tags/dialects don't.
9. Inconsistent response shapes: tag/dialect return `{ created }`, speaker/source don't.
10. `PATCH /sentences/{id}` can edit a text-linked sentence too (no guard) — maybe fine.
11. Source slug rename doesn't rewrite referencing rows (documented; silently orphans).
12. No per-key rate limiting (acceptable given 256-bit keys; a leaked key can hammer).

## DECISIONS (locked) → BUILD PLAN

1. **Texts full CRUD** — POST/GET/GET[id]/PATCH/DELETE. Ordered child sentences via
   fractional sort_key. Text-sentences are standalone (NO senses_in_sentences junction).
2. **Reader**: `?include=senses` on entries list (batched, senses-only, opt-in) + texts read.
3. **Idempotency via client-supplied `id`** (Jacob's idea — zero storage vs an external_id
   column). Optional `id` (UUID v4) on entries/senses/sentences/texts. On POST, if the entry
   `id` already exists → SKIP the whole item, report `status: 'exists'` (don't clobber — that's
   PATCH). Validate UUID format (400 on bad). **DROP `external_id`** entirely (ignore if sent).
   merge_dict_row is an LWW upsert, so the existence check MUST happen before merge.
4. **BODY_SIZE_LIMIT=16M** in docker-compose `environment:` + documented ceiling in openapi.
5. **Role/access decoupling**: `verify_dict_api_access` takes `access: 'read' | 'write'`.
   Key path checks scope DIRECTLY (read endpoints accept read|write; write requires write).
   Human-session fallback (isolated) maps read⇒contributor+ (member), write⇒editor+. No more
   contributor/editor language leaking onto keys. `load_v1_dictionary_context({ access })`.
6. **Agent feedback** → `POST /api/v1/dictionaries/{id}/feedback` (access read, so read keys too).
   Creates a `message_threads` row (`source: 'agent_feedback'`, unresolved, assigned to Jacob
   `jwrunner7@gmail.com`), a `messages` row, snapshots the key creator as from_*, fires
   notify_admins. Anti-flood: per-key in-memory limit 3/hr + 10/day (429), and ≥10 open feedback
   threads → append to newest instead of new thread. Response `{ received, relay_to_human }`.
7. Fill tests: texts, sources, speakers, feedback, include=senses, idempotency-skip, read-key-403.
   Validate speaker gender∈{m,f,o} + decade numeric. Add log_server_event to speakers/tags/dialects.

## Build order
- [x] `lib/api/v1/fractional-index.ts` (+ test) — key_between for sentence ordering (canonical dgreensp midpoint)
- [x] `verify-dict-api-access.ts` + `v1-route-context.ts` → access:'read'|'write' (key scope checked directly; human fallback isolated in ACCESS_TO_HUMAN_ROLE)
- [x] update ALL v1 endpoints role→access
- [x] `entry-input.ts`: +id (resolve_client_id/is_uuid), drop external_id, +skipped counter, +ends_paragraph on SentencePatch
- [x] `v1-entry-write.ts`: client-id + skip-exists (entry_exists); sense/sentence id passthrough; ends_paragraph in sentence patch
- [x] entries list `?include=senses` (batched load_senses_for_entries)
- [x] `lib/db/server/v1-texts.ts` + `texts/` + `texts/[textId]/` endpoints (create/list/get/patch/delete)
- [x] `feedback/` endpoint + per-key limiter + FEEDBACK_OWNER + submit_agent_feedback (message_threads assigned to Jacob)
- [x] `openapi.ts` + `/api/v1/+server.ts` landing docs (id workflow, texts, feedback, ~16MB body limit)
- [x] docker-compose BODY_SIZE_LIMIT=16M (LOCAL). PROD: still must add BODY_SIZE_LIMIT=16M to sveltekit-living.env (needs tuf decryption)
- [x] speaker validation (gender m/f/o, integer decade) + telemetry on speakers/tags/dialects
- [x] tests: texts, sources, speakers, feedback, fractional-index, idempotency-skip, include=senses, read-key-403/read-ok

## Bug found + fixed along the way
- `remove_source_from_all` (pre-existing) spread RAW dict rows into merge_dict_row, which
  re-stringifies JSON columns → DOUBLE-ENCODED lexeme/notes/etc. on every entry/sentence/text that
  referenced a deleted source. Fixed by parse_dict_row before re-merge. Same class of bug avoided in
  the new v1-texts reorder/title paths. Regression test in sources/server.test.ts.

## Verification
- `pnpm check` → 0 errors. `pnpm eslint` (changed files) → 0. v1 suite 143 passed; affected 30 passed.

## REMAINING MANUAL STEP (prod)
- Add `BODY_SIZE_LIMIT=16M` to `~/code/vps-setup/secrets-decrypted/sveltekit-living.env` (tuf only —
  needs decryption pw) then `bin/sync living`. Without it, prod caps bulk import bodies at 512K.

## Migration paragraph handed to Jacob's already-running agent (external_id → client id)
Delivered in chat; depends on this work being deployed first.
