# New-entry 404 race — "Entry not found" right after creating a headword

Reported by alclaveria@gmail.com (user 38d0a0fb, dict boienen-old-buhi-langua) 2026-07-03; confirmed
in prod client_logs: ~57 `Entry not found` events / 6 users since the cutover flip (also milang
editor 9eb22405 ×9, ewdebe 2415e20c ×10). Every "add new headword" navigation 404s; refresh fixes.

## Root cause

`insert_entry` (`$lib/db/dict-client/operations.ts`) awaits the wa-sqlite write, then immediately
`goto(/dict/entry/{id})`. The entry page load (`[dictionaryId]/entry/[entryId]/+page.ts`) warm
branch:

1. checks the `entries_data` read-model — fed **asynchronously** by the orama-watcher
   (`tables_changed` broadcast → delta scan → `apply_rows`) → new row usually not there yet
2. falls back to the server endpoint — sync engine hasn't **pushed** the new entry yet → null
3. → `error(404, 'Entry not found')`

The load comment "an absent entry here is genuinely missing" is wrong for just-created entries.

## Fix

In the warm branch, before 404ing: if the server fetch returns null, wait (bounded, ~4s) for the
read-model to deliver the entry; only 404 if neither source produces it. Fixes all racy paths
(create, fast search-result click) — not just insert. Also `insert_entry` now navigates to
`dictionary.url` (see friendly-dict-urls.md).

## Tasks
- ✅ Bounded read-model wait (4s) in entry +page.ts warm branch — server fetch first, then
  `wait_for_local_entry` subscribes to `entries_data` with timeout; only then 404
- ✅ Local browser verification (headless puppeteer): create dict → Add Entry → headword renders
  on `/entry/{uuid}`, zero alerts/pageerrors
- [ ] Post-deploy: watch `Entry not found` rate in prod client_logs (should drop to ~0 for
      logged-in editors; anonymous `entry/list` hits fixed by the redirectId view-name fix)
