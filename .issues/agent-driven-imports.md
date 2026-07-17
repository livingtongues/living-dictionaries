# Agent-driven imports: import page redesign, source files, message copy, API guides, final Supabase/import teardown

Decided with Jacob 2026-07-17. Imports are now done by OUR AI agents from any format —
the import page becomes an upload-resources + request-import flow that lands as a message
to Diego, whose agent does the import via the v1 API.

## Locked decisions
- Import page is **manager-only** (menu already gates `is_manager`; gate the page too).
- Resource bytes → **R2**, key prefix `import/{dict_id}/{file_id}`, **presigned PUT** upload
  (like the GCS media flow), **100MB/file cap** ("if larger, something's wrong").
- **`source_files` = server-only dict-db table** (excluded from syncable set). Listing via
  gated endpoint (manager+/admin), download via gated streaming endpoint. NEVER visible to
  visitors.
- **No auto source creation.** Diego's agent decides: a random spreadsheet is not a source;
  a published-book PDF scan is. A guide doc (linked in the request message) teaches the
  agent when/how to create a `sources` row and link the file to it.
- **`message_threads.dictionary_id`** — new nullable column (shared.db migration). Populate
  for import requests + contact submissions carrying one. Copy button falls back to parsing
  the thread `url` slug for old threads.
- Import-request threads **deterministically auto-assign to Diego** (skip LLM triage) + ntfy.
- **Inbound email addressed to an admin's ld_address auto-assigns to that admin**
  (jacob@ → Jacob, diego@, greg@, cailie@ — just these). Skip LLM triage for those too?
  → yes, directed mail needs no classification (still notify the assignee).
- **Remove Anna from ADMINS** (`$lib/admins.ts`).
- **Format guides**: lean markdown docs in `$lib/api/v1/guides/*.md`, served at
  `/api/v1/guides` (list) + `/api/v1/guides/{slug}` (raw markdown), referenced from the
  spec index/description, rendered as a section on /admin/api-docs.
- **Copy button on every admin message**: name, email, user id, dictionary id, body — one
  click → paste into an agent thread.
- **SideMenu**: Agents pill moves down 2 → order becomes History, Sources, Agents, Import, Export.
- **"Editor" is not a real dict role** — dictionaries have managers + contributors only
  (both `can_edit`). Fix "View as Editor" → "View as Contributor" and sweep the mistake.
- **Teardown**: ALL remaining Supabase + import scripts deleted (`scripts/import/`,
  `scripts/supabase/` incl. `config-supabase.ts` + `reset-local-db.ts` +
  `delete-dictionary-media/`, `scripts/types/supabase/`, `scripts/download-audio.ts`).
  Only `supabase-creds.private` (gitignored) stays on disk. Q4 full scrub of incidental
  mentions approved. `.knowledge/migration/` condenses to ONE page. GCS orphan cleanup:
  Jacob will deal with later — not our problem.

## Key codebase facts (researched)
- `sources` table (dict db): slug/citation/abbreviation/author/year/url/license/type/orthography.
  Managed at `/[dict]/sources`; v1 endpoints exist (`$lib/db/server/v1-sources.ts`).
- `message_threads` has `url`, `from_user_id`, `from_email` — NO dictionary_id yet. Contact
  endpoint (`/api/messages/contact`, X-Internal-Secret) already receives `dictionary_id`.
- Triage routing: `$lib/agent/triage/routing.ts` (content/partnership → Diego). Auto-assign
  machinery in `apply-triage.ts`. Inbound email: `/api/messages/email-inbound` +
  `$lib/agent/email-inbound-hook.ts` (`fire_agent_email_inbound`).
- R2: `$lib/r2/client.ts` (S3 client) + put/get/delete-attachment. Presigned pattern lives in
  the GCS media flow (`$lib/media/upload-media.ts`, `/api/upload`); need
  `@aws-sdk/s3-request-presigner` for R2 presigned PUT (check if installed).
- Dropzone pattern: `$lib/components/image/ImageDropZone.svelte`.
- Agent API blurb: `$lib/components/settings/AgentPrompt.svelte` (reuse text for message body).
- Spec slicing ALREADY live: `/api/v1/openapi.json?view=index` + `?tag=…`
  (`$lib/api/v1/openapi.ts`: `OPENAPI_TAGS`, `select_openapi_view`, `tag_for_path`).
  /admin/api-docs groups ops by path (`helpers.ts build_groups`) with pill jump-nav, but the
  giant `info.description` prose wall drowns the structure → IA redesign w/ sticky TOC.
- View-as personas: `$lib/auth/view-as.ts` (`PreviewDictRole = 'manager' | 'editor'`),
  applied in `[dictionaryId]/+layout.ts` (role math lines ~48–63). `dictionary_roles.role`
  enum includes 'editor' but comments confirm no prod grants (VERIFY on VPS before sweep).
- `is_editor_or_above` = admin|manager|editor (used ~15 files) vs `can_edit` (incl.
  contributors). With 'editor' gone these become is_manager_or_admin — rename candidate.
- Import page i18n keys `import_page.*` in EN JSON get retired; new EN keys added.

## Work plan

### 1. Quick wins ✅ = done
- ✅ SideMenu: Agents now sits below History + Sources, right above Import.
- ✅ Anna removed from `ADMINS` (routing comment, digest-cron comment, apply-triage test name).
- ✅ View-as: `PreviewDictRole` → `'manager' | 'contributor'` (view-as.ts + ViewAsBanner story).
- ✅ Editor sweep (prod verified: 1742 manager / 317 contributor, ZERO 'editor' in roles+invites):
      `is_editor_or_above` DELETED — replaced by `is_manager` everywhere; ROLE_RANK now
      contributor:1/manager:2 with `?? 0` guard (unknown/legacy role can never pass a gate);
      default min_role now 'manager'; v1 session-write + api-keys list + history gates →
      'manager'; role unions/enums/UI options/e2e swept ('editor' remains only as generic
      English: history "Editor" column label, test user-id strings, prose).
      tsc clean; 153 targeted tests pass.

> ✅ VERIFICATION COMPLETE 2026-07-17 (this session): `pnpm lint` clean (fixed 13 errors: 5 auto,
> 8 by hand — array/object destructuring, dropped needless `async` on guides GETs + test helpers,
> import order); `pnpm check` 0 errors; full `pnpm test` GREEN (233 files passed / 1 skipped,
> 1693 tests); `tsc --noEmit` exit 0. Dev server on :3041 killed. No new .knowledge needed
> (supabase-cutover.md + .knowledge/db/ reorg already cover it). AWAITING Jacob: commit decision.
>
> Phase 5 ✅: guides (`$lib/api/v1/guides/` — importing/spreadsheets/flex-lift/pdf-scans + index.ts
> loader w/ tests), `/api/v1/guides` + `/[slug]` routes, openapi spec: `files`+`guides` tags, 7 new
> paths + SourceFile schema + "Uploaded resources & import guides" description section, path-inventory
> test updated; /admin/api-docs REDESIGNED (sticky TOC sidebar, tag-based groups via `build_tag_groups`,
> info.description split into accordion via `split_markdown_sections`, guides section; dead path-based
> grouping helpers removed).
> Phase 6 ✅: scripts/{supabase,import,types,download-audio.ts,vitest.config.import.ts,record-logs.ts,logs}
> deleted; creds moved to `scripts/supabase-creds.private` (still gitignored via root bare-name rule);
> scripts package.json trimmed to 6 devDeps + lockfile reinstalled (15 tests pass); archive/{history,
> api-keys} deleted; `supabase_date_to_friendly`→`date_to_friendly`; all incidental comments/config
> lines scrubbed; `.knowledge/migration/` DISSOLVED → current guidance in `.knowledge/db/` (+ index),
> `shared-stack-conventions.md` at knowledge root, history condensed to `.knowledge/supabase-cutover.md`;
> stale `.knowledge/domain/dictionary-import-process.md` deleted; `.issues/post-cutover-teardown.md`
> deleted; AGENTS.md updated (scripts, roles, import route, guides, admin-directed email); repo-wide
> `grep -ri supabase` → only the one knowledge page, this issue file, the creds file, gitignored artifacts.
> Browser-verified in dev (:3041): full upload→instructions→request flow via curl + headless puppeteer;
> import page + ImportFileCard stories (light/dark/mobile); admin thread w/ Diego auto-assign +
> per-message copy payload (clipboard-verified; NOTE: admin local-first pages need a REAL allow-list
> login like jwrunner7@gmail.com — the dev_admin_level cookie doesn't pass /api/admin-sync); api-docs
> TOC/groups/guides render clean, zero page errors. ALSO: mustang / was 100% full — pruned 16GB of
> docker build cache (left the tutor render-worker images alone).
>
> PROGRESS 2026-07-17: phases 2–4 built. Phase 2 ✅ (migration `20260717_message_thread_dictionary_id.sql`,
> contact endpoint writes dictionary_id, `assign_directed_thread` + `get_admin_by_ld_address` wired into
> email-inbound w/ targeted ntfy + triage skip, per-message CopyButton w/ `message_copy_payload` on the
> admin thread page). Phase 3 ✅ REVISED: `source_files` lives in **shared.db** (server-only; a dict-db
> table would leak via the full-backup R2 snapshot!) — migration `20260717a_source_files.sql`,
> `$lib/db/server/source-files.ts`, `$lib/r2/import-files.ts` (presign/head/delete, dev-media fallback),
> v1 routes `files/` (GET list, POST presign), `files/[file_id]` (GET download, PATCH incl. source_id
> validation vs dict-db sources, DELETE w/ requested-lock), `confirm`, `request-import` (thread+message,
> Diego auto-assign via route_admin_for_category('content'), agent-ready body) + `_call.ts` + 12 tests.
> Phase 4 ✅: import page redesigned (`$lib/import/` — ImportFileCard, UploadProgressRow,
> upload-import-file.ts), new `import_page.*` EN keys, stories verified light/dark/mobile.
> Remaining: phase 5 (guides + api-docs IA + openapi spec entries for /files), phase 6 teardown,
> full-suite verify + dev browser E2E.

### 2. Messages: dictionary_id + copy button + admin auto-assign
- [ ] shared.db migration `2026….sql`: `ALTER TABLE message_threads ADD COLUMN dictionary_id TEXT`.
      (Server-run AND admin-client-run — syncable table, column must exist on clients.)
- [ ] Contact endpoint + import-request endpoint write it; email-inbound sets it when derivable.
- [ ] Copy button on every message in `/admin/messages/[thread_id]` (and unmatched?): copies
      From name/email/user_id, dictionary id+slug (column, else parse thread.url), body_text.
- [ ] Inbound to_email = an admin ld_address → auto-assign that admin, skip triage, notify them.

### 3. source_files + upload/download endpoints
- [ ] Dict-db migration: `source_files` table — id, source_id (nullable REFERENCES sources),
      filename, mimetype, size_bytes, storage_key, import_instructions, source_note,
      import_requested_at, uploaded_by_user_id, created_at, updated_at, deleted (soft?).
      Server-only: exclude from syncable set (follow existing server-only table pattern).
- [ ] Presign endpoint (manager+): validates mimetype/size ≤100MB, returns presigned R2 PUT
      for `import/{dict_id}/{file_id}`; client PUTs direct; confirm endpoint creates the row.
- [ ] GET listing endpoint (manager+/admin) for import page + sources page.
- [ ] GET download endpoint (manager+/admin) — stream from R2 w/ content-disposition.
- [ ] DELETE (manager+, only before import_requested_at set; admins always).
- [ ] v1 API surface for Diego's agent: GET files list, GET file download, PATCH file
      { source_id } to link after creating a source. Tag: `sources` (or new `files` tag).

### 4. Import page redesign (`/[dictionaryId]/import`)
- [ ] Manager-only gate (others see educational content + contact/sign-in nudge).
- [ ] Copy: we import ANY format — spreadsheets, docs, FLEx/LIFT, Toolbox/MDF, ELAN, legacy
      fonts, PDF scans of printed dictionaries — no exceptions. AI-assisted, human-reviewed.
- [ ] Reword the "want it done faster" note as an integrated self-serve panel (agents page link).
- [ ] Dropzone (generalize ImageDropZone pattern) + durable uploaded list (fetch on load):
      filename/size/status; per-file REQUIRED import-instructions textarea + optional source
      box; delete button (pre-request only).
- [ ] "Request import" button (enabled when all pending files have instructions) → authed
      endpoint → creates thread+message (subject "Import request — {dict}", dictionary_id
      set, body = uploader info + per-file {name, size, download URL, instructions, source
      note} + API pointers (base, openapi.json, guides list, dict id) + link to the
      import-orchestration guide). Auto-assign Diego + ntfy.
- [ ] New EN i18n keys; retire old `import_page.*` template-link keys.

### 5. API guides + api-docs IA
- [ ] `$lib/api/v1/guides/*.md` — starter set: `importing.md` (orchestration: triage resource
      type, when to create sources, link file→source, batching, idempotency),
      `spreadsheets.md`, `flex-lift.md`, `pdf-scans.md` (grow over time; distill any gems
      from scripts/import before deleting it).
- [ ] `/api/v1/guides` (JSON list) + `/api/v1/guides/[slug]` (text/markdown). Reference from
      spec info.description + `?view=index` output.
- [ ] /admin/api-docs redesign: sticky sidebar TOC (overview / auth / tags / schemas /
      guides), collapse the description wall into sections, render guides.
- [ ] Update AgentPrompt / import-request blurb to mention guides.

### 6. Teardown + scrub (Q4A approved)
- [ ] Delete: `scripts/supabase/` (ALL — config-supabase.ts, reset-local-db.ts,
      delete-dictionary-media/), `scripts/import/`, `scripts/download-audio.ts`,
      `scripts/types/supabase/` (+ fix `scripts/types/index.ts` re-exports),
      `scripts/vitest.config.import.ts`, related package.json scripts + unused deps.
      KEEP `supabase-creds.private` on disk (gitignored).
- [ ] Delete supabase-touching `archive/` files (api-keys external-api, history).
- [ ] Rename `supabase_date_to_friendly` (utils/time.ts) → `date_to_friendly` + call sites.
- [ ] Reword incidental comments: schemas (shared.types, dictionary.types, 2×initial.sql —
      comments only, compat sections stay), markdown/{html-to-markdown,extensions}.ts,
      entry.worker.ts, typography.css, mode.ts, types/db.ts, seed-achi-fixture.ts,
      send-emails-with-mailchannels.md (delete stale snippet), .issues/future/markdown-tables.md.
- [ ] Config lines: .dockerignore `supabase`, .githooks/pre-commit comment, scripts/.gitignore
      `.env.production.supabase`. Root .gitignore keeps `supabase-creds.private`.
- [ ] `.knowledge/db/` → condense to ONE page (`.knowledge/supabase-cutover.md` or
      similar); update `.knowledge/index.md`; move still-current guidance (e.g.
      adding-a-syncable-dict-table.md) to proper category w/ mentions scrubbed.
- [ ] Close out `.issues/post-cutover-teardown.md` (all items now resolved — delete the file).
- [ ] Final check: `grep -ri supabase` → only creds file + the one knowledge page.

### Verification
- svelte-look stories for import page states (manager w/ files, empty, non-manager),
  SideMenu order, api-docs page; browser test upload flow in dev (R2 presign needs real creds
  → dev fallback? check how dev handles R2 attachments); `pnpm test`, `tsc`, `pnpm check`,
  `pnpm lint`. Message flow: dev-auth as manager, upload, request, check /admin/messages.
