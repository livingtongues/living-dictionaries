# A 404 tells users "we've run into an error" and offers no way back

Triggered by Cosmas Rai's 2026-08-03 report: *"The Dictionary 'Girlangue' does not open anymore.
The link does not respond."* (thread `0761059a-e41b-4204-9d08-c962f41acfbd`).

## What actually happened (production, verified)

**Nothing was wrong with his dictionary.** `girlangue-ghana` is healthy:

| check | result |
|---|---|
| catalog row | present, `public=0`, `bucket='glossary'`, 41 entries |
| his role | `manager` (also manager of `adzagbe-lexicon`) |
| SSR | `/girlangue-ghana` → 200, `/girlangue-ghana/entries` → 200 |
| snapshot | `snapshot_uploaded_at` 2026-08-03T11:33Z (fresh) |
| his own session after the email | searched "chi" and deleted the entry *chillax* at 11:04 — the app worked |

What he actually hit was **one bad link**: `/girlangue-ghana/entry/497bb70f-6852-418d-ba0a-5ff66a933b44`.
That entry id has **never existed** — not in the dict db, not in the `deletes` tombstones, not in
`girlangue-ghana.history.db`, and the first request for it in ALL of `logs.db` is 2026-08-03
10:56:58 with **empty breadcrumbs** (direct navigation, not a click inside the app), first in Safari
while logged out, then 4× in Chrome after signing in. He is browsing with `utm_source=copilot.com`
on the same dictionary, so a chatbot-fabricated URL is the likeliest source. Either way: a link to
a nonexistent entry, not data loss.

**The bug is what we showed him.** `/{dict}/entry/{bad-id}` throws a 404, the root
`src/routes/+error.svelte` catches every status identically and renders:

> **We're sorry, we've run into an error.**
> The error has been recorded and we will be looking into it. **Can you please send us a short note
> to explain what happened?**  [Contact Us]
> Error: 404 - Entry not found

No link to the dictionary. No link home. Just an apology for a crash that didn't happen, and a
button to report it — which is exactly what he did: the thread's `url` column IS that entry URL, so
the report was filed **from the error page's own Contact form**. A 404 on one word convinced a
manager his whole dictionary was gone.

## Scale (30 days, production `logs.db`)

- **769 real browser sessions** rendered a 404 error page (`context.status = 404`, `session_id NOT NULL`).
- Common shapes: legacy routes on dictionaries that still exist (`/{dict}/synopsis`, `/{dict}/overview`,
  `/oromo/entries/list?utm_source=chatgpt.com`), slugs of long-deleted dictionaries (`/paza/grammar`,
  `/akkadian/grammar`, `/xinka`, `/cholti/entries` — none of these are in the catalog), and dead
  entry links like this one.
- Same page also serves 5xx (`Internal Error`, 336 sessions/30d — mostly the stale-bundle
  `Failed to fetch dynamically imported module`, tracked separately in
  `.issues/stuck-old-bundle-escape-hatch.md`).

## Done (2026-08-03, Jacob chose A / A / B)

- ✅ `src/routes/[dictionaryId]/+error.svelte` — anything thrown BELOW the dictionary layout (a dead
      `entry/[entryId]` id, an unmatched sub-path) now renders inside the dictionary chrome, side
      menu intact, with **Browse entries** + **Dictionary home**. A failure in the dict LAYOUT load
      still lands on the root boundary, so `data.dictionary` is always present here.
- ✅ Root `+error.svelte` — branches on `page.status`: 404 → calm panel + Go to the homepage /
      Browse dictionaries; everything else → the unchanged apology, Contact Us and `ref:` id.
- ✅ Extracted `$lib/components/shell/CrashReport.svelte` (the old apology, verbatim) and
      `NotFoundPanel.svelte` (title / explanation / links + a de-emphasised "Think this is a
      mistake? Contact Us"), so both boundaries share one implementation.
- ✅ `$lib/debug/log-error-page.ts` — the telemetry both boundaries call. Row shape is unchanged
      (`context.status` / `cause` / `error_id` / `origin`), so the analytics side keeps working and
      404s inside a dictionary are still counted.
- ✅ Catch-all `[dictionaryId]/[...unmatched]/` — known legacy paths **301** (`synopsis` /
      `overview` → dictionary home, `search` → `/entries`, query string preserved), everything else
      404s inside the dictionary chrome. `legacy-paths.ts` has inline vitest coverage; nothing is
      guessed — an unlisted path is a real 404.
- ✅ i18n: 9 new `error.*` keys in `src/lib/i18n/locales/en.json` only.
- [ ] Reply to Cosmas — **Jacob is writing it.** Facts he needs: dictionary healthy, 41 entries,
      nothing lost; that entry id never existed; the working link is
      `https://livingdictionaries.app/girlangue-ghana`.

## Verification

`pnpm test` (2572 pass), `tsc --noEmit` clean, `pnpm eslint` 0 errors, `pnpm check` 0 errors.
Headless puppeteer against dev :3041 — bad entry id, unknown dictionary sub-path, unknown slug, a
forced 500 (apology + `ref:` preserved), dark mode, and the Contact modal still opening from the new
panel. Redirects verified: `/achi/synopsis` + `/achi/overview` → 301 `/achi`, `/achi/search` → 301
`/achi/entries`; `/api/*`, `/admin/*`, `/about/*` and `entries/list|table` unaffected. Telemetry rows
re-read out of `.data/logs.db` to confirm the shape didn't drift.

Note: `pnpm eslint --fix` will strip legitimate `eslint-disable no-restricted-syntax` comments in
`lib/api/v1/guides/index.ts` + `lib/server/host-stats.ts` — reverted here, don't commit those.
