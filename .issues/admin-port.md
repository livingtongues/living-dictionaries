# Port the example's full `/admin` section + client admin sync engine

Bring the **entire** `living-dictionaries-example` admin over (replacing our older Supabase-stub
admin), archive the current one, wire it to our real M4 backend. User: "copy across the whole
admin folder … start with schema … apply theme.css + relatives to the admin route for now."

## Why this is big
Our current `/admin` is the OLD Supabase-stub admin (`+layout.ts` uses `supabase.from(...)` +
`cached_query_data_store`). The example's `/admin` is a **fully rebuilt local-first admin**: every
page reads a reactive **client-side wa-sqlite mirror of `shared.db`** (the *generic* admin sync
engine — distinct from our existing per-dict `dict-client/*` engine) and pushes edits back via
`/api/admin-sync`. So porting the pages requires porting that engine first. This is LD's analog of
house's HOUSE-ADMIN port (house `.knowledge/architecture/firestore-to-sqlite-admin-port.md`).

## Groundwork already in place (verified)
- ✅ `shared.ts` drizzle schema is **byte-identical** to the example (users, dictionaries,
  dictionary_roles, dictionary_partners, invites, message_threads, messages, message_attachments,
  email_codes, email_aliases, client_logs, + migrations/db_metadata/deletes). No DB schema work.
- ✅ `lib/db/client/{connection.ts, live/notifier.ts, live/reconcile-rows.ts}` identical (shared
  infra already vendored for `dict-client`).
- ✅ `lib/db/server/{shared-db,dictionary-db,dictionary-sync-helpers}.ts` present (dict-sync-helpers
  identical). `lib/admins.ts`, `lib/auth/{verify,jwt,user.svelte}.ts`, `lib/constants.ts` present.
- ✅ Root layout provides `auth_user` (`$lib/auth/user.svelte`, has `.user` + `.logout()`) and
  `page.data.admin` (= `ssr_user?.admin_level ?? 0`). `better-sqlite3`, `drizzle-orm`, `svelte-look`
  installed.

## Gaps to fill (verified net-new vs current)
**External deps:** `dagre@^0.8.5`, `@types/dagre@^0.7.54`, `@xyflow/svelte@^1.5.2` (graph viewer).

**Client admin sync engine (net-new):**
- `lib/db/client/db.ts` (`get_admin_db`)
- `lib/db/client/live/{live-db.svelte.ts, table-store.svelte.ts, types.ts}`
- `lib/db/sync/{engine.svelte.ts, errors.ts, types.ts, history.svelte.ts, last-visit-ping.ts, SyncStatus.svelte}`
- `lib/db/server/sync-helpers.ts` (shared.db `process_sync`; SyncableTableName = users[readonly],
  dictionaries, dictionary_roles, dictionary_partners, invites, message_threads, messages, message_attachments)
- `routes/api/admin-sync/{+server.ts, _call.ts}`

**Schema viewer (the "start with schema" deliverable; works fully once engine lands — incl. the
Local admin.db tab):**
- `lib/db/introspect.ts` (+ inline vitest)
- `routes/api/admin/schema/{+server.ts, _call.ts, server.test.ts}`
- `routes/api/admin/schema-from-sql/{+server.ts, _call.ts, server.test.ts}`
- `routes/admin/schema/**` (+page, paste-pane, schema-cards, table-card, local-db-source.svelte.ts,
  _mock-schema.ts, graph/{build-graph.ts, schema-graph.svelte, table-node.svelte, graph-toolbar.svelte})

**Admin shell + support (net-new):**
- `routes/admin/{+layout.svelte, +layout.ts, +page.ts}` (+page redirects → /admin/messages)
- `lib/layout/UserMenu.svelte`, `lib/components/LoginModal.svelte`
- `lib/utils/{admin-back.svelte.ts, csv.ts, format-bytes.ts, format-relative-time.ts, fuzzy-score.ts, html-to-text.ts, requests.ts}`
  (requests.ts = example's get/post helper; map onto our `$lib/helpers/get-post-requests` OR bring as-is)

**Admin data pages (net-new):**
- `routes/admin/users/**` + `routes/admin/users/[user_id]/**`
- `routes/admin/dictionaries/**`
- `routes/admin/messages/**` (+ `[thread_id]/**`, `resolved/`)
- `routes/admin/sync/**`
- `lib/admin/{AdminBadge, AssigneeDropdown, DictionaryPickerModal, MessagesTable, UserPickerModal}.svelte`
- `routes/api/admin/users/[id]/unsubscribe/{+server.ts, _call.ts, server.test.ts}` (direct shared.db
  write — `users` is download-only on admin clients)
- `lib/components/entry/BadgeArray.svelte`

**CSS:** `lib/theme.css` + `lib/buttons.css` (light/dark vars + btn-* classes), applied to admin route.

**Stories:** the various `_page.stories.ts` / `*.stories.ts` / `_mock-schema.ts` (svelte-look).

## Known adaptations (not blockers)
- **Auth gate:** example layout uses `auth_user.user.is_admin` + `error(403)`; adapt to our
  `admin_level` model (gate on `admin >= 1`, matching current `AdminGuard`/`page.data.admin`).
- **svelte-pieces divergence:** example admin imports a **flat runes-snippet** set
  (`$lib/svelte-pieces/{ShowHide,Modal,CopyButton,RichTextEditor,persisted-state.svelte,toast.svelte}`),
  but our vendored set is **nested + legacy-slot** (`functions/ShowHide.svelte` uses `<slot>`,
  `ui/Modal.svelte`, no toast module/CopyButton/RichTextEditor/persisted-state). → bring the flat
  files the admin needs (decision below).
- **Toast:** example uses a `toast.svelte.ts` module + host; our app uses `components/ui/Toasts.svelte`.
- **`requests.ts`:** alias example `$lib/utils/requests` onto our `$lib/helpers/get-post-requests`, or
  bring the example file. (Either; the schema `_call`s only need get/post.)

## Phased plan (each phase builds + checks green before the next)
- **P0 — Prep.** Add deps (dagre/@types/dagre/@xyflow/svelte, lockfile-faithful). Bring `theme.css` +
  `buttons.css` (scoped). Archive current `/admin` (location TBD). Bring the flat svelte-pieces the
  admin needs + toast (strategy TBD).
- **P1 — Client admin sync engine.** Port `client/db.ts`, `client/live/{live-db,table-store,types}`,
  `sync/*`, `server/sync-helpers.ts`, `/api/admin-sync`. Verify it builds + a client admin.db opens +
  syncs-down from server shared.db (no UI yet).
- **P2 — Schema viewer ("start with schema").** Port introspect + 2 endpoints + `/admin/schema/**`.
  Verify endpoint tests + render the page (all 4 source tabs, graph mounts).
- **P3 — Admin shell.** Port `+layout.{svelte,ts}` + `+page.ts` + UserMenu + LoginModal + utils.
  Adapt auth gate. Verify the shell renders for an admin and gates a non-admin.
- **P4 — Data pages.** users, dictionaries, messages, sync + `lib/admin/*` + unsubscribe endpoint +
  entry/BadgeArray. Verify each lists/edits against seeded shared.db.
- **P5 — Full verify.** check 0 / test green / build + `node build` boot; introspect+endpoint tests;
  e2e admin-login (dev-OTP admin) deep flow; svelte-look screenshots. Jacob eyeballs :3041.

## Verification tooling
- `pnpm --filter=site check` (0 errors), `test --run`, `build` + `node build` boot.
- New `e2e/admin-flow.mjs` (shared `browser-launch.mjs`): dev-OTP login as admin → /admin/schema graph
  mounts → /admin/users + /dictionaries + /messages list → /admin/sync dashboard; assert no pageerror.
- svelte-look screenshots of admin pages (light/dark via theme.css).
- ⚠️ Local `.data/shared.db` may have sparse messages/users → pages render empty gracefully; seed if needed.

## Decisions (Jacob, 2026-06-05)
1. **svelte-pieces:** bring the example's **flat runes-snippet** pieces the admin needs
   (`ShowHide, Modal, CopyButton, RichTextEditor, persisted-state.svelte, toast.svelte` + toast host)
   as a **parallel set**; admin imports those, the rest of the app keeps its nested legacy set untouched.
2. **theme/buttons:** **scope** the CSS-var defs + base bg/color/font onto an **`.admin-root` wrapper**
   (light/dark/system replicated under `.admin-root`), so zero effect on the UnoCSS main site.
   `btn-*` classes scoped under `.admin-root` too.
3. **archive:** **git-only** — just delete the current Supabase-stub `/admin`; rely on git history /
   the example repo. (No `_archive/` copy.)
4. **verify:** **full** — per-phase check/build green, port unit tests (introspect + 3 endpoint
   server.tests), new `e2e/admin-flow.mjs` deep flow, svelte-look screenshots; Jacob eyeballs :3041.

## Refined phasing (route swap is atomic — new layout ⇄ new pages all share data.db/sync/auth_user)
Bring all LIB-level deps first (dormant, must typecheck), then swap the route wholesale.
- **P0 — deps + lib leaves.** ✅ deps (xyflow/dagre, lockfile clean). Then: theme.css+buttons.css
  (scoped `.admin-root`), flat svelte-pieces (parallel), utils, lib/admin/*, LoginModal,
  entry/BadgeArray, layout/UserMenu, introspect.ts. All dormant; `check` green.
- **P1 — client admin sync engine.** client/db.ts, client/live/{live-db,table-store,types},
  sync/*, server/sync-helpers.ts, /api/admin-sync, /api/admin/schema*, /api/admin/users/[id]/unsubscribe.
  Dormant; `check` green.
- **P2 — THE ADMIN ROUTE SWAP (atomic).** Delete old /admin; copy example /admin/* wholesale
  (layout/+page.ts + schema, users, dictionaries, messages, sync). Adapt auth gate (admin_level),
  svelte-pieces import paths, theme wrapper, requests helper. **Verify schema page FIRST** (Jacob's
  "start with schema"), then the rest. `check`+build green.
- **P3 — full verify.** tests (introspect + 3 endpoints) · e2e/admin-flow.mjs · svelte-look shots ·
  node build boot · Jacob eyeballs :3041.

## Progress log
- ✅ **P0 deps:** `@xyflow/svelte@1.6.0`, `dagre@0.8.5`, `@types/dagre@0.7.54` added. Reverted a
  picomatch@4.0.2→4.0.4 peer-flip drift (svelte-check/fdir); `git diff pnpm-lock.yaml` = intended
  new pkgs only; `pnpm install --frozen-lockfile --offline` passes. ⚠ xyflow 1.6.0 ≠ example 1.5.2
  (both satisfy ^1.5.2) — verify graph in P2, pin if broken.
- (continuing P0: CSS + lib leaves)
</content>
</invoke>

## Progress (2026-06-05, P0–P2 done)
- ✅ **P0 deps:** xyflow@1.6.0, dagre, @types/dagre, tiptap*, unplugin-icons; Icons({compiler:'svelte'})
  in vite.config + `~icons` types in app.d.ts; admin-theme.css (scoped `.admin-root`). picomatch dedup
  accepted (benign, unavoidable under pnpm 10.33). check baseline 0/16.
- ✅ **P1 client admin sync engine:** client/db.ts, client/live/{live-db,table-store,types}, sync/*,
  server/sync-helpers.ts, /api/admin-sync + /api/admin/schema* + /api/admin/users/[id]/unsubscribe.
  + flat svelte-pieces (ShowHide/Modal/CopyButton/RichTextEditor/persisted-state/toast/Toasts/Slideover/
  portal/trapFocus), utils (admin-back/csv/format-bytes/format-relative-time/fuzzy-score/html-to-text/
  requests), lib/admin/{AdminBadge,UserPickerModal,DictionaryPickerModal}, introspect, entry/BadgeArray.
  Added const ADMIN_DB_ID_FOR_USER_PREFIX. AuthUserData already has is_admin/avatar_url (no auth adapt).
- ✅ **P2 route swap (minus messages):** deleted old Supabase-stub /admin; brought example /admin/*
  (+layout/+page/+layout.ts + schema/users/dictionaries/sync). Adapted: LoginModal→app's AuthModal;
  UserMenu simplified (dropped SideMenuContent/ColorSchemeToggle); +page.ts redirect /messages→/users;
  removed Messages nav link; `.admin-root` wrapper + admin-theme import. Brought dict-edit endpoints
  (/api/dictionaries/[id] DELETE with R2+orphaned-media STRIPPED/deferred; roles + roles/[role_id]).
  DictionaryRow CoordinatesModal usage adapted to the app's event-based modal (on:update/remove/close).
- ✅ **Gate:** check 0 errors / 18 warnings · build ✔ (only pre-existing AWS/d3/jszip circular warns) ·
  `node build` boots · curl /admin→307, /admin/{schema,users,dictionaries,sync}→200 (signed-out shell,
  no SSR 500) · test 54 files / 300 pass.

## DEFERRED — messages section (needs Jacob's call)
Messages is the one section that drags in heavy infra ABSENT from the current repo + tied to
**R2 (explicitly deferred this month)**:
- `$lib/email/{send-raw-email,addresses,loop-protection,find-or-create-thread}` (send-raw-email needs
  a NEW dep **nodemailer** + SES) · `$lib/notifications/notify-admins` · `$lib/r2/put-attachment` (R2) ·
  email render component (MessageReply) · ingestion endpoints (contact, email-inbound) ·
  /api/messages/{reply,assign}. Plus lib/admin/{AssigneeDropdown,MessagesTable} (removed for now) +
  /admin/messages/**.
Cleanly separable: all other admin sections work without it. Default admin landing temporarily /users.

## Remaining
- Messages: Jacob decides defer vs port email-infra (+nodemailer, R2 stubbed) vs full (R2).
- Authenticated verification: e2e/admin-flow.mjs (dev-OTP admin → schema graph + users/dicts/sync lists)
  + svelte-look screenshots. Jacob eyeballs :3041.

## UPDATE (Jacob 2026-06-05): messages INCLUDED, with R2 attachments
Clarification: R2-deferral was about **media** (stays on legacy GCS); **R2 attachments ARE wanted**
(box already set up). So messages ported FULLY incl. R2 attachments.
- ✅ deps: `nodemailer@^8.0.8` + `@types/nodemailer` (purely additive, no drift).
- ✅ lib: `$lib/email/{addresses,find-or-create-thread,loop-protection,send-email,send-raw-email}`,
  `$lib/notifications/notify-admins`, `$lib/r2/{client,delete-object,put-attachment}` (attachments use
  `R2_ATTACHMENTS_BUCKET`; snapshots `R2_SNAPSHOTS_BUCKET`). Re-added lib/admin/{AssigneeDropdown,MessagesTable}.
- ✅ email render: `routes/api/email/components/{BaseLayout,MessageReply}.svelte` (parallel to the
  existing old email component set). **BaseLayout fix:** moved its nested `<head><style>` into a
  `{@html}` string + dropped `<svelte:options css="injected">` — Svelte 5.56 (vs example's 5.55) errored
  ("`<script>` left open") parsing the full-document component's nested style block.
- ✅ routes: `/admin/messages/**` + `/api/messages/{reply,assign,contact,email-inbound}`.
- ✅ Restored Messages nav link + `/admin`→`/admin/messages` redirect.
- TS-lib fixes (current repo lower target than example): `new Error(msg,{cause})` → `Object.assign(new
  Error(msg),{cause})` (×2); `for..of` over `doc.images`/`input.files` → `Array.from(...)` (×2).

## FINAL GATE (full admin, all 5 sections)
- ✅ check **0 errors / 18 warnings** · build ✔ · `node build` boots · curl /admin→307,
  /admin/{messages,schema,users,dictionaries,sync}→200 (no SSR 500) · **test 57 files / 327 pass** ·
  svelte-look: schema tabs+icons+cards render.
- ⚠️ Env Jacob must set on VPS for messages: `R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_ATTACHMENTS_BUCKET` (attachments) + SES (already present) for reply send. Unset → reply-with-
  attachment throws; text reply + inbox/assign still work.
- ⛔ Still deferred (correctly): dict-DELETE R2-snapshot + orphaned-MEDIA cleanup (snapshot builder +
  GCS media are the deferred features) — dict delete still removes the row + dict.db file.

## Remaining
- Authenticated live verification: e2e/admin-flow.mjs (dev-OTP admin → schema graph + users/dicts/
  messages/sync with synced data) + Jacob eyeballs :3041 (graph/maps need real browser).
- Not committed (per policy).

## VISUAL VERIFICATION (svelte-look, all sections) ✅
- **schema**: source tabs + `~icons` render · populated **cards** (PK/FK/indexes/defaults) ·
  **xyflow+dagre graph** (table nodes laid out, toolbar hide-junction/system, zoom, minimap). xyflow
  1.6.0 works (no pin to 1.5.2 needed).
- **messages**: inbox table (From/Subject/To/Assigned dropdowns/Last-activity, filter tabs).
- **users**: table (Admin badge, dictionary roles, threads, unsub toggle, CSV export).
- **dictionaries**: table (managers/contributors +Add/✕, pending invite, coordinates, ISO/Glottocode).
- **sync**: dashboard in all 4 states (complete / syncing / error / idle).
STATUS: P0–P2 + messages COMPLETE & verified. Only authenticated live flow (real login + server data
sync, graph interactivity, real reply email) left for Jacob at :3041. Not committed.
