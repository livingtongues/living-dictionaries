# Import UI feedback pass (screen recording, 2026-07-25) — DONE

Jacob's narrated walkthrough of `/admin/imports` + `/{dict}/import/{thread}`.
13 items. Frames in `/tmp/horse-feedback/2026-07-25_09-16-15-160/items/`.

## Items

1. ✅ **Enxet: backfilled Jacob's email reply into the import conversation.** Thread
   `66c9b38b-bec4-4155-99c9-cf6a41cd3476` (dict `enxet`) held only a system line.
   Copied from Gundolf's contact thread `0d217640-3cdd-456b-9a00-a84c1143a79b`:
   message `6eecf142…` (admin, 2026-07-25T00:54:58Z) → new `cfc2bfba-6414-49bf-a2a2-caff71430b35`,
   and `2ad3252a…` (customer, 09:26:44Z) → new `64093977-69c0-4ac6-ba6d-994f6196b4b4`.
   Original `created_at` preserved; `server_seq` auto-assigned by trigger so admin
   clients sync them. No re-email sent. No report artifact exists — untouched.
2. ✅ **`/admin/imports` → real sortable table.** "Show resolved" checkbox gone;
   everything shows, open group first, resolved under a "Past imports" heading
   with a gap. Default sort recency desc; every column sortable (click header,
   click again to flip). Table extracted to `$lib/import/admin/ImportsTable.svelte`
   (+ `.stories.ts`) so it can be screenshot-verified with real data shapes.
3. ✅ **Lock icon dropped.**
4. ✅ **"Waiting on" column** (Us / Them / —) + a Questions column that reads
   `2/6 answered` or `all 4 answered`.
5. ✅ **Four statuses** derived in `$lib/import/import-status.ts` (unit tested):
   Submitted → In progress → Waiting on them → Resolved.
6. ✅ **Copy job brief** — unchanged, on every row.
7. ✅ **Submitter name links to `/admin/users/{id}`** (`requester_user_id` added
   to `AdminImportRow`).
8. ✅ **Enxet requester repointed to Gundolf** (`f5b8fdfb-4cf8-4d00-a1a4-cc536ca06f80`
   / `gundolfn@gmail.com`). Diego's `thread_participants` row kept — he really did
   upload it; Gundolf added as a second manager-side participant.
9. ✅ **Book icon next to the dictionary name links to `/{dict}`**; the name still
   goes to the conversation.
10. ✅ **Page-title audit.** Root cause: `[dictionaryId]` pages get their `<title>`
    from `SeoMetaTags`, and four pages had none — `sources` (bare `<title>Sources</title>`,
    no dict name), `import`, `import/[thread_id]`, `invite/[inviteId]`. A page with
    no `<title>` doesn't reset the document title on client-side nav, so "Sources"
    leaked onto the Import page. All four now use `SeoMetaTags` like every sibling.
11. ✅ **Save button always rendered** in `QuestionCard` (disabled until dirty,
    reads "Saved" once stored). `import_page.questions_intro` EN copy now says
    "click Save on each one".
12. ✅ **`padding-bottom: 3rem`** on both the import page and the conversation page.
13. ✅ **Verified: ONE record.** `source_files` row (e.g. eastern-pomo
    `01bfb112-d17c-4bf0-86e7-1cd7f8d6b7a1`) with one R2 key
    `import/{dict}/{file_id}`; `source_id` surfaces it on Sources, `import_thread_id`
    surfaces it in the import conversation. Two views, one row, one object.

## Bonus fix found along the way

`has_activity_since_resolve` compared only `last_message_at > resolved_at`, so a
resolved thread's final "thanks!" would flag "new activity" forever. It now also
requires that no team-side participant has read since — `MAX(thread_participants.last_read_at)
WHERE side='team'`.

## How it was verified

- `pnpm test` / `pnpm check` / `pnpm lint` clean.
- svelte-look stories: `ImportsTable` (Default / AllOpen / Narrow), `QuestionList`.
- Puppeteer against dev (port 3041) with seeded import threads: column sorting
  asc/desc, all three link targets, question save round-trip
  (disabled → enabled → "Saved", progress 0→1 of 6), and titles across a real
  client-side nav from `/river/sources` → `/river/import`. Seed data removed after.

## Not deployed

Code changes are committed to the working tree only — the prod DB surgery (items
1 + 8) is already live. Backup taken first:
`/opt/hosting/data/shared.db.bak-20260725-095947`.
