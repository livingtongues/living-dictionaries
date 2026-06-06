# Port globe route, harden contact form, port migrate-to-sqlite; update plan

Branch `svelte-5-migration`. Four asks from Jacob (2026-06-05). Goal: stop leaning on the
`living-dictionaries-example` repo — everything needed lives here. Verify with
`pnpm --filter=site check` (0 errors) + `test --run` + scripts vitest where possible.

## 1. Pull over `routes/globe` (Jacob is building a future map idea)
Example's globe is a **self-contained custom D3/versor canvas globe** (NOT the home page's
Mapbox globe). Files to bring:
- `site/src/lib/components/globe/` — `Canvas.svelte`, `Globe.svelte`, `Zoomer.svelte`,
  `DictionaryPoints.svelte`, `constants.ts`, `data/{countries,land}-{50m,110m}.json`,
  `utils/{scale-canvas,versor-zoom}.ts`.
- `site/src/routes/globe/{+page.ts,+page.svelte}`.
- **Fixups for this repo:** `$lib/layout/{Header,Footer}` → `$lib/components/shell/{Header,Footer}`
  (both exist here). Resolve the deleted `$lib/mocks/dummy-dictionaries` + `HomeDictionary` type
  dependency (DECISION below).
- Verify: `check` 0 errors; (Jacob eyeballs the canvas render on `:3041` — agent has no WebGL).

## 2. Ensure the contact form is robust
This repo ALREADY has the newer messages-based contact (NOT the example's older `api/contact`):
- UI: `site/src/lib/components/modals/Contact.svelte`
- API: `site/src/routes/api/messages/contact/{+server.ts,_call.ts}`
- Plan: audit ours for validation, error handling, spam/honeypot, success UX, rate-limiting;
  harden gaps. Do NOT import the example's older endpoint.

## 3. Port ALL migrate-to-sqlite scripts → `scripts/migrate-to-sqlite/`
The Supabase(Postgres)→SQLite cutover pipeline. 7 files: `read.ts`, `mappers.ts`, `db-insert.ts`,
`open-sqlite.ts`, `verify.ts`, `migrate.ts`, `migrate.test.ts`.
- **Path fix:** `open-sqlite.ts` schema dirs `../../../site/...` → `../../site/...` (scripts/ is
  top-level here, not under `packages/`). Folder names match: `shared-migrations`,
  `dictionary-migrations`.
- **Deps:** `scripts/` lacks `better-sqlite3` + `fractional-indexing` (has `pg`, `tsx`,
  `vitest@2.1.4`, `config-supabase.ts`). scripts/ is OUT of the pnpm workspace (workspace=`site`
  only) and has its own node_modules (no lockfile). DECISION below on install/verify.
- **npm scripts:** add `migrate-to-sqlite{,:dry}` + `verify-migration` to `scripts/package.json`.
- **Schema drift risk:** example mappers were written for the example schema; this repo added
  `entries.linguistic_history` + `dictionaries.snapshot_uploaded_at`. `migrate.test.ts` (run
  against this repo's real schema via open-sqlite) is the feedback loop to catch drift.
- Scope guard: do NOT get pulled into the broader scripts/ supabase-removal cleanup (separate pass).

## 4. Update `.issues/cross-project-orchestration.md`
- migrate-to-sqlite now lives in THIS repo (`scripts/migrate-to-sqlite/`), not "peek in example".
- R2 snapshot builder is DONE (was listed Deferred "not this month") — commit 391d88c0.
- globe route pulled; contact hardened.

## Decisions (Jacob, 2026-06-05)
- Globe data source: **real** public dictionaries (reuse home's `/api/dictionaries?visibility=public`).
- migrate-to-sqlite verification: **install** — add deps + standalone `pnpm install` in `scripts/`.

## PROGRESS (2026-06-05)
- ✅ **Part 1 — globe route pulled.** Copied `$lib/components/globe/` subtree + `routes/globe/`.
  `+page.ts` now loads real `DictionaryView[]` from `/api/dictionaries?visibility=public`;
  `+page.svelte` rewired (`HomeDictionary`→`DictionaryView`, `$lib/layout/*`→`shell/*`,
  `setCurrentDictionary` camelCase, `<Footer />` reads page data itself). Added site deps
  `d3`/`d3-force`/`versor` + `@types/d3`/`@types/topojson-client` (devDeps). Fixed latent
  `og/SvgGlobe.svelte` topojson type error (`as any`, surfaced by adding @types/topojson-client) +
  silenced 2 `state_referenced_locally` warnings in `Globe.svelte` via `untrack`. **check 0 errors,
  18 warns (baseline), 360 tests pass.** NEEDS: Jacob WebGL eyeball on `/globe`.
- ✅ **Part 2 — contact wired to messages, SES removed (Jacob: ALL contact → `api/messages/contact`,
  never SES, all flow to admin backend + admin notify pings).**
  - Created the public proxy `api/contact/{+server,_call}` (ported from example) — injects
    `INTERNAL_INGEST_SECRET` server-side + forwards to the secret-gated `api/messages/contact`.
  - Rewired `Contact.svelte`: ALL subjects now → `api_contact(...)` (dropped the 3 SES branches +
    `api/email/{support,learning_materials,request_access}` imports). Subject label via
    `t(subjects[subject])` (+ dictionary name when present); added `required` to the topic select;
    fixed the misplaced `{:else if status==='fail'}` branch.
  - **Admin notify pings:** added `notify_admins(...)` (ntfy) to the `api/messages/contact` ingest
    AND to `api/messages/email-inbound` (its TODO's blocker was stale — `ntfy_topic` now exists), so
    every contact-form + inbound-email message buzzes admins with a `/admin/messages/<id>` link.
  - **Notification model (Jacob, 2026-06-06):** generic support → backend thread + ntfy ping to the
    admin team (Jacob `living_pings`; Jacob to ADD diego/anna/greg to `$lib/admins.ts` ADMINS with
    their own ntfy topics for them to be pinged). `request_access` → backend thread + ping **PLUS**
    SES email to the targeted dictionary's `manager`-role users (as before) — plumbed `subject_key` +
    `dictionary_id` + `dictionary_name` through `Contact.svelte`→`api/contact`→`api/messages/contact`,
    which now looks up managers and `send_email`s them (fire-and-forget, dev fails soft).
  - ✅ **Deleted** `api/email/{support,learning_materials,request_access}` (incl. request_access/_call).
  - ⚠️ Behavior change to confirm: `learning_materials` no longer SES-emails the 7000 team
    (`info@7000.org`) — it now lands in the backend + admin ping only. `getSupportMessageRecipients` /
    `getLanguageLearningMaterialsRecipients` in `addresses.ts` are now unused (left in place).
- ✅ **Part 3 — migrate-to-sqlite ported** (Jacob renamed dir → `scripts/supabase-cutover/`). 7 files;
  `open-sqlite.ts` path `../../../site`→`../../site` (still correct at the new depth); added
  `better-sqlite3`/`fractional-indexing`/`@types/better-sqlite3` + 3 npm scripts to `scripts/package.json`;
  converted scripts/ `workspace:`→`link:` so standalone `pnpm install --ignore-workspace` works.
  **`migrate.test.ts` 10/10 green vs live schema** (at new path). Prod run needs Supabase creds — Jacob's.
- ✅ **Part 4 — orchestration.md** reflects R2 done, migrate-to-sqlite in-repo (`scripts/supabase-cutover/`),
  experimental /globe (Jacob's concurrent rewrite already integrated these).
