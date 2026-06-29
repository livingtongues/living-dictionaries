# Create-dictionary: hard reload → soft `goto`

## Goal
Replace the `window.location.replace('/<id>/entries')` at the end of the
create-dictionary flow (`src/routes/create-dictionary/+page.ts`) with a soft
SvelteKit `goto`, so the local-first runtime (per-dict leader worker, sync
engine, continuous log session) stays alive instead of a full page reboot.
Must be smooth for a brand-new dictionary that has no server snapshot yet.

## Architecture findings (confirmed by reading code)

### When is the per-dict server DB created?
- The create endpoint (`api/dictionaries/create/+server.ts`) writes ONLY to
  **shared.db**: a `dictionaries` catalog row + a `dictionary_roles` manager row
  for the creator, in one transaction. It does NOT touch any `dictionaries/<id>.db`.
- The server-side per-dict file `dictionaries/<id>.db` is created **on demand**
  by `get_dictionary_db(id)` (`db/server/dictionary-db.ts` → `open_dictionary_db`
  → `new Database(path)` creates the file + runs migrations + stamps schema
  version). That fires the FIRST time either endpoint runs:
  - `GET /api/dictionary/[id]/db` (editor snapshot fetch — during dict-client boot
    for an editor/manager), or
  - `POST /api/dictionary/[id]/changes` (first push of a dirty row).
- So: NOT created at create time. For a manager opening the new dict it's
  created at **snapshot-fetch time during boot** (editor path), otherwise at
  **first sync push**. Either way, before/at first sync — never at create.

### Client boot for a brand-new dict
- `[dictionaryId]/+layout.ts` opens the dict via `open_dict({ has_editor_role:
  can_edit })`. `dict-instance.ts` `drop_in_snapshot()` explicitly treats a
  snapshot-fetch failure (e.g. "R2 404 for a brand-new dict") as **non-fatal** —
  falls through to an empty OPFS DB, runs migrations, sync backfills. So the dict
  layout will NOT error even on the viewer path. ✅ (this de-risks the whole change)

### The real smoothness risk: edit capability
- `can_edit` is computed from the **client** `dict_roles` store
  (`me/dictionary-roles.svelte.ts`), refreshed in the root `+layout.ts`.
- With a WARM cache the root layout only does `void dict_roles.refresh_if_stale()`
  (fire-and-forget; skips if <1h old). So right after creating a dict, the new
  manager grant is often NOT in the store yet → `can_edit=false` → worker opens
  pull-only → the brand-new manager can't add entries until a later refresh, and
  the boot uses the R2 viewer path (404 → empty, fine, but wrong source).
- FIX: after a successful create, `await dict_roles.refresh()` (reads shared.db
  which already has the grant) BEFORE navigating, then
  `goto(url, { invalidateAll: true, replaceState: true })`.
  - `invalidateAll` re-runs the layout loads so catalog row + role take effect
    (root layout's `refresh_if_stale` no-ops since we just refreshed).
  - `replaceState` preserves the old `.replace()` behavior (Back ≠ create form).

### Spinner
- `Form.svelte` sets `loading=true` for the whole `await onsubmit(...)`. Because
  `create_dictionary` now `await`s the create + roles refresh + `goto`, the submit
  button spins until client-side navigation completes. ✅ (matches the ask)

## Plan
- [x] Read create endpoint, dict-db server, dict-instance boot, root + dict
      layouts, dict_roles store, Form.svelte. (done above)
- [x] Edit `create-dictionary/+page.ts`: import `goto`, pull `dict_roles` from
      parent, `await dict_roles.refresh()` then `goto(..., { invalidateAll,
      replaceState })`.
- [x] Browser-verify on mustang dev (port 3041): regression script
      `site/tools/e2e/create-dict-soft-nav.mjs`. ALL 8 assertions PASS:
      logged_in, soft_nav_no_full_reload (probe survived + doc_loads unchanged),
      landed_on_entries, spinner_shown, non_admin_manager_can_edit (add-entry
      button present for a fresh @example.com manager), server_db_created_with_entry
      (entries:1), no_real_page_errors, no_real_bad_responses.
- [x] Report given.

## Verified findings
- SOFT NAV CONFIRMED: window `__probe` survived + `__doc_loads` unchanged across
  the transition (a hard reload would reset both). No `/api/log` Failed-to-fetch.
- can_edit works for a fresh NON-admin manager ONLY because of the added
  `dict_roles.refresh()`. Without it the warm cache wouldn't surface the grant.
- Server `dictionaries/<id>.db` creation timing (empirically pinned):
  - At create API call: NOT created (only shared.db catalog rows written).
  - `server_db_at_boot` probe = `{ exists: true, entries: 0 }` → merely OPENING
    the dict as the manager created the empty server DB, BEFORE any edit. Cause:
    the editor dict-client boot fetches its snapshot via `GET /api/dictionary/[id]/db`,
    which calls `get_dictionary_db(id)` server-side (creates the file + migrations).
  - First edit → `/changes` push populates it (entries:1).
  - (A pure VIEWER reads the public R2 snapshot, which does NOT call
    get_dictionary_db — so for a never-edited viewer the server DB is created
    later, when an editor or the snapshot-builder cron first touches it.)
- Ambient noise (NOT from this change, only in the add-entry phase): Keyman
  on-screen-keyboard `osk/kmwosk.css` 404 + an occasional Keyman wrapper
  `firstElementChild` blip in headless. The script filters these as ambient.

## Testing gotcha discovered
`jwrunner7@gmail.com` (the email the existing e2e harnesses log in as) is a
LEVEL-2 site admin, so those harnesses get `can_edit` via the admin shortcut and
NEVER exercise the non-admin manager path. Use a fresh `@example.com` user to
test role-gated behavior.

## Notes / gotchas
- Dev mode shows a `confirm()` before create + prefills test data on mount + a
  "Dev: Add Test Dictionary Immediately" button — handle the dialog in puppeteer.
- mode `import.meta.env.MODE` gates the confirm.
