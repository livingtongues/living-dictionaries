# Agent-friendly bulk write API (v1) + PDF import proof

## Goal

Make Living Dictionaries agent-friendly: a third party who knows agents grabs an
**API key from their dictionary's Settings**, pastes a short instruction to their
agent, and the agent self-discovers a comprehensive `/api/v1` write API able to do
**any edit/addition a human editor could do, in bulk**. We prove it ourselves by
OCR-parsing a printed-dictionary PDF (Baidu **Unlimited-OCR**, run privately on tuf)
and pumping the entries in *through the API* (pretending we lack direct DB access).

## Decisions (locked with Jacob)

- **Q1 keys**: per-dictionary keys, created in that dict's Settings (manager-gated),
  scoped to ONE dictionary, default **manager-level** writes, labeled + revocable.
- **Q2 shape**: clean nested/semantic JSON under versioned `/api/v1/*`. Entry →
  nested senses → glosses/parts_of_speech/semantic_domains/example_sentences; plus
  speakers/tags/dialects sub-resources. Bulk = array.
- **Q3 scope**: ALL text/structured content now, full create/update/delete. Media
  (audio/photo/video) deferred to phase 2.
- **Q4 bulk**: per-item best-effort with a `{ created, updated, failed:[{index,error}] }`
  report; each entry's multi-table write is atomic on its own. Optional caller
  external id for idempotent re-runs.
- **Q1b docs**: tiny human blurb in Settings ("here's your key, point your agent at
  `/api/v1/openapi.json`"); the comprehensive surface is machine-readable OpenAPI +
  an agent-oriented reference the agent fetches itself.
- **Q2b propagation**: write through `process_dict_changes` → identical to a human
  push. Normal snapshot cron + `/changes` pull handle propagation. NO special
  scheduling.

## Architecture (the key insight)

```
POST /api/v1/dictionaries/:id/entries
  → verify_dict_api_access(event, dict_id, 'editor')   # API key OR session
  → build_dict_changes_from_entries(input)             # semantic JSON → rows
       (entries, senses, sentences, senses_in_sentences,
        dialects+entry_dialects, tags+entry_tags  — find-or-create junctions)
  → process_dict_changes({ db, request:{dirty_rows,deletes},
        user_id: key.created_by_user_id, is_editor:true, history_db })
  → per-item report
```

Reuses 100% of the existing server write/sync/history machinery. Server generates
row UUIDs; LWW + history + `shared.db.updated_at` mirror all happen inside
`process_dict_changes` exactly as for a browser push.

### No dict.db migration needed
All target columns already exist (`entries`, `senses`, `sentences`,
`senses_in_sentences`, `dialects`, `entry_dialects`, `tags`, `entry_tags`,
`speakers`). Phase-1 schema work is confined to `shared.db` (`api_keys`).

## Phase 1 — API key infra (shared.db)  ✅ (UI panel pending)

- ✅ Migration `shared-migrations/20260629_api_keys.sql` + Drizzle `api_keys` in
  `schemas/shared.ts`. Server-only (NOT in `SYNCABLE_TABLE_NAMES`).
- ✅ `$lib/api-keys/api-key.ts`: `generate_api_key` (`ldk_` + base64url(32B)),
  `hash_api_key`, `create_api_key`, `list_api_keys`, `delete_api_key`,
  `verify_api_key` (throttled `last_used_at`). Tested (`api-key.test.ts`, 10).
- ✅ Endpoints `POST/GET /api/dictionaries/[id]/api-keys` +
  `DELETE …/[key_id]` (manager-gated) + `_call.ts`. Tested (`server.test.ts`, 7).
- ✅ Settings UI panel (manager-only) — `$lib/components/settings/ApiKeys.svelte`:
  list (prefix…last4, label, role, last-used) / create (one-time token reveal +
  copy) / delete, + a one-line blurb linking `/api/v1`. Mounted in
  `[dictionaryId]/settings/+page.svelte` under `{#if is_manager}`. Visually
  verified via svelte-look (`ApiKeys.stories.ts`).

## Phase 2 — v1 auth + semantic→rows builder  ✅

- ✅ `$lib/auth/verify-dict-api-access.ts`: `ldk_` key path (hash lookup, dict-scope
  match, role gate) OR session/JWT fallback. user_id = key creator (FK-null →
  `apikey:<id>` sentinel).
- ✅ `$lib/db/server/v1-entry-write.ts` `apply_entry_writes`: nested EntryInput →
  rows applied via the EXPORTED `merge_dict_row` (same path as a browser push →
  history + `last_modified_at` triggers). Per-item SAVEPOINT best-effort;
  find-or-create dialects/tags (deduped by name); `import_id` → private tag.
  Input helpers in `$lib/api/v1/entry-input.ts`. Tested (`v1-entry-write.test.ts`, 7).

## Phase 3 — entries create + reads + tests (the proof path)  ✅

- ✅ `POST /api/v1/dictionaries/[id]/entries` (single / bare array / `{entries,
  import_id}`; max 1000/req; mirrors shared.db.updated_at). Tested (api-key + session).
- ✅ `GET /api/v1/dictionaries/[id]/entries` (filter: elicitation_id, lexeme substring,
  updated_since, limit/offset, has_more) — for idempotency/dedupe. Tested.
- ✅ `GET /api/v1/dictionaries/[id]/entries/[entryId]` (full nested via
  `build_entry_data`). Tested.
- ✅ `GET /api/v1/dictionaries/[id]` (meta: gloss_languages, orthographies, …).
  Resolves url-slug. Tested.

**Status: 39 tests green, lint clean, `pnpm check` 0 errors.**

## Phase 4 — update + delete + sub-resources  ✅

- ✅ `PATCH /api/v1/dictionaries/[id]/entries/[entryId]` — field-merge entry + sense
  upsert-by-id + append example sentences + additive dialect/tag links. Returns
  updated nested entry. (`apply_entry_update`; reads existing row + overlays so
  `merge_dict_row`'s INSERT…ON CONFLICT has a full NOT-NULL-satisfying row; strips
  `updated_by_user_id` so the editor re-stamps.)
- ✅ `DELETE …/[entryId]` — `deletes` tombstone → `process_delete_cascade` (senses +
  junctions cascade; standalone sentences survive, matching human-delete). History
  delete event recorded.
- ✅ speakers/tags/dialects `GET` list + `POST` (speakers create; tags/dialects
  find-or-create, case-insensitive dedup). `$lib/db/server/v1-sub-resources.ts`.
- ✅ Tested at apply-layer + endpoint level; **live-smoke verified** over HTTP
  (PATCH cross-endpoint dialect dedup, DELETE→404).
- Deferred: bulk update/delete variants (not needed for the proof).

**Total: 59 new tests green, lint clean, `pnpm check` 0 errors.**

## Phase 5 — discoverability  ✅

- ✅ `GET /api/v1/openapi.json` — curated OpenAPI 3.1 (`$lib/api/v1/openapi.ts`),
  public, CORS `*`, server origin from the request. 6 paths, bearerAuth, full
  schemas (MultiString/EntryInput/SenseInput/SentenceInput/SensePatch/EntryPatch).
- ✅ `GET /api/v1` — tiny agent+human HTML landing (auth note, quickstart curl,
  link to openapi.json). Live-verified.
- ✅ `.knowledge/api/v1-write-api.md` written.

## DONE (phases 1–3 of Jacob's "do 1,2,3 now"):
All API key infra + the full write/read surface + discoverability are built,
tested (63 tests across 8 files), lint-clean, `pnpm check` 0 errors, and
**live-verified over HTTP** (create/list/read/patch/delete + speakers/tags/dialects
+ openapi). Settings UI panel screenshotted. Awaiting the PDF for Phase 6 (proof).

## Phase 6 — PDF OCR proof (on tuf)  ⬜

- ⬜ Get sample pages; benchmark Unlimited-OCR fidelity (IPA/diacritics) vs Claude
  vision. Run private (offline env vars, no-egress). See OCR analysis below.
- ⬜ OCR → LLM-structure → entry JSON → call the API with a real key. Verify with
  reads + the dictionary UI.

## Unlimited-OCR notes (from analysis)

- MIT license. ~6.67GB bf16 weights (DeepSeek-V2 MoE decoder + SAM/CLIP encoder).
  Built for long-horizon multi-column doc parsing — good fit for a printed dict.
- **Privacy**: model `*.py` audited clean (no network/telemetry; "report" hits are
  a tokens/sec stdout counter). Run with `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
  HF_HUB_DISABLE_TELEMETRY=1`; firewall egress to be safe. Avoid the HF Space
  (uploads images) and prefer plain `transformers`/official vLLM over the bundled
  sglang wheel.
- **Hardware**: tuf 6GB VRAM is JUST under bf16 weights → needs int4/int8 quant OR
  CPU/hybrid offload (fine for a one-shot batch, slower) OR a rented 16–24GB GPU.
  mustang has NO GPU (2 vCPU/7.8GB) — out.
- **Caveat**: real risk is diacritic/IPA fidelity + structuring. Always two-stage:
  OCR → LLM structure → verify against the page image. Benchmark before full run.

## Cross-machine

I'm on mustang; the PDF + GPU are on tuf. Build the API on mustang/local dev (no PDF
needed). OCR runs on tuf (drive via `horse --host tuf`, or Jacob runs a script). For
a quick structure/fidelity look, get sample pages to mustang via R2 or any URL (my
Read tool reads PDFs directly).

## Open questions / notes

- Idempotency: agent persists returned `external_id→entry_id` map; server offers
  lookup-by-`elicitation_id` + optional import tag. No new column (no dict migration).
- Rate/size limits on bulk: decide a sane max items/request (e.g. 500) + payload cap.
- Proof target dict + environment (local dev vs deployed new.livingdictionaries.app):
  TBD with Jacob.
