# Execute the approved items from the 2026-07-28 nightly reports

Sources: `.cron/log-reviews/2026-07-28.md` (log review) and
`~/code/horse/.cron/business-reviews/living-dictionaries-2026-07-28.md` (business review).
Jacob approved each item explicitly in the 2026-07-29 morning debrief.

**Everything stays uncommitted** — Jacob reviews and commits (push = deploy).

## 1. ✅ Share-card dimension ceiling (house → LD port)

`/og` read `props.width` / `props.height` straight out of the (attacker-controllable) query
string and passed them to satori/resvg unbounded: `{"width":20000,"height":20000}` asks for a
1.6 GB allocation on a 2-core box. House sidesteps this by ignoring requested dimensions
entirely. Yesterday's repair bounded **how often** the server draws, never **how big** one
drawing may be.

- NEW `site/src/routes/og/card-dimensions.ts` — `CARD_WIDTH`/`CARD_HEIGHT` + `card_dimension()`
  clamping to 200…2400 px, with inline vitest.
- `+server.ts` clamps BEFORE the render and writes the clamped values back into `props`, so the
  component's inner geometry matches the viewport it is drawn into.
- No caller varies the size (`SeoMetaTags` defaults 1200×630 and nothing overrides it), so the
  clamp is invisible in practice — a ceiling, not a behaviour change.

## 2. ✅ Outbound-fetch allow-list for card background photos

Same endpoint, same root cause: `props.image_url` was fetched by this server (`card_image` →
`sharp`) or by satori inside the worker, whatever host it named — a classic SSRF into
`169.254.169.254`, `localhost`, or an arbitrary internet host paid for by our egress.

- `card-image.ts` gains `is_allowed_card_image_url()`, gated on the R2 media host
  (`R2_MEDIA_DOMAIN`) + `https:`, with a DEV-only exception for `localhost` `/api/dev-media/`.
- `card_image()` refuses anything else BEFORE any fetch and logs `og_image_url_blocked`; the
  caller already renders the photo-less globe card when it gets `null`.
- Gate sits ahead of the `is_decodable_by_card_renderer` fast path on purpose — a decodable
  extension used to skip the transcode and hand the URL to satori, which fetched it itself.

House is getting the same change from a sibling worker (do not edit that repo here).

## 3. ✅ Curator question placement — ask each question ON the rows it is about

The business review's highest-value item. 15 curator questions issued, 3 answered (20%), 0 of the
6 put to the most engaged curator — who then spent his evening hand-filtering
`?q={"no_audio":true,"no_part_of_speech":true}`, which is literally what two of his unanswered
questions were about. The artifact was right; the placement was wrong.

Verified against source before implementing (the business report's scoping was accurate):

- `thread_questions` already carries `report_anchor`, and `QuestionCard.svelte` already renders a
  deep link from it — this is the same pattern pointed at a second target.
- The entries view already takes the whole filter vocabulary as `?q=<json>` (`QueryParamState`,
  `lib/search/types.ts`); the URL REPLACES the params object rather than merging, so a generated
  link must carry `page: 1` itself.

Shipped:

- Migration `20260729a_thread_question_entries_query.sql` + Drizzle schema: `entries_query`
  (validated JSON) and `entries_query_label` (optional agent-authored button text, e.g.
  "Show me these 1,191 entries").
- NEW `site/src/lib/search/entries-query-link.ts` — the shared vocabulary check
  (`parse_entries_query`) and href builder (`entries_query_href`), unit-tested.
- `POST …/conversations/{thread_id}/questions` accepts `entries_query` as an OBJECT, validates
  every key/value against the real filter vocabulary (unknown key → 400 naming the key), and
  stores the normalized JSON.
- `QuestionCard.svelte` renders a primary "Show me these entries" button (agent label wins when
  given) next to the existing report link, targeting `/{dictionaryId}/entries?q=…`.
- Guide `$lib/api/v1/guides/importing.md` + `openapi.ts` teach the agent to attach a query to
  every question it can — the guides are the primary doc layer, so the judgement call lives there.
- EN i18n key `import_page.question_entries_link`; stories + svelte-look screenshots.

Follow-up for Jacob (needs the deploy first, so NOT done here): hand-fill the two live 'Iipay Aa
questions — #2 → `{"sources":["mg-bitd-wordlist"],"has_audio":true}`, #3 →
`{"sources":["mg-bitd-wordlist"],"no_part_of_speech":true}` — and watch whether answered/issued
moves on that import. SQL is at the bottom of this file.

## 4. ✅ fill-translations never pushes or commits

Standing decision (2026-07-29): the lane makes its edits and STOPS, leaving everything
uncommitted for Jacob — the same contract as every other worker. It still writes the production
`shared.db` (that IS the lane's product); what is removed is the git commit + push of the seed
files, which was a deploy.

- `.claude/commands/fill-translations.md`: frontmatter, step 4, and step 5 rewritten.
- NEW `.cron/fill-translation-reviews/decisions.md` (the folder the lane's digests actually land
  in — singular "translation") with the dated standing decision.

## 5. ✅ Share-card worker residual — issue confirmed accurate + brought up to date

`.issues/og-render-off-main-thread.md` ends with a "never reached production" status from 21:05
UTC 2026-07-28. That is now stale: the repair shipped in `1a169a89` (2026-07-29 01:17 UTC). Issue
updated with the post-deploy production read (see it for numbers) and with the explicit note that
LD's capacity settings are NOT endorsed for porting to house.

## 6. ✅ Cloudflare cache posture — written up, nothing applied

No credentials requested, no zone touched. See "Cloudflare desired-state file" below and the
summary. The knowledge page `.knowledge/api/snapshot-cdn.md` now states plainly that LD has no
checked-in desired state and what has to be read from the zone first.

## Bonus fix found while verifying item 5

`render-worker.js` `load_dynamic_asset` fell back to `code = 'unknown'` **without re-reading
`names`**, so any script missing from `language_font_map` hit `for (const name of undefined)` →
`names is not iterable`, caught and mis-logged as `dynamic_font_fetch`. One wasted attempt and a
misleading log per unmapped text run (production caught it on an emoji card at 01:35:58 UTC
today). Fixed; it is three lines and sits inside the file item 5 covers.

## Verification

- `pnpm check` — **0 errors** (3,169 files).
- `pnpm lint` on every touched path — clean (two autofixed: import order, operator linebreak).
- Targeted suites — `og/server.test.ts` + `og/card-image.ts` + `og/card-dimensions.ts` (33),
  `search/entries-query-link.ts` + the conversations API suite (33), `og/render-pool` +
  `og/render-worker` (13) — all pass.
- Full `pnpm test`: 2,332 passed / 10 failed — **every failure is a load flake**, not a
  regression: this box was running several other agent sessions, and all four files
  (`og/render-pool`, `og/render-worker`, `db/server/dictionary-sync`, `server/i18n/i18n-db`) pass
  in isolation. Re-run the suite on a quiet box before reading anything into it.
- Visual: svelte-look `QuestionList/MixedKinds`, light + dark, 760 and 390 wide.

---

## Post-deploy SQL for the two live 'Iipay Aa questions (Jacob, after deploying item 3)

```sql
-- On the living VPS, /data/shared.db. Titles are matched loosely; check the SELECT first.
SELECT id, position, substr(title,1,80) FROM thread_questions
WHERE dictionary_id = 'iipay-aa' AND status = 'open' ORDER BY position;

UPDATE thread_questions
   SET entries_query = '{"page":1,"sources":["mg-bitd-wordlist"],"has_audio":true}',
       entries_query_label = 'Show me the entries that already had a word',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id = '<question #2 id>';

UPDATE thread_questions
   SET entries_query = '{"page":1,"sources":["mg-bitd-wordlist"],"no_part_of_speech":true}',
       entries_query_label = 'Show me the entries with no part of speech',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id = '<question #3 id>';
```

## Cloudflare desired-state file (investigation only — item 6)

What the repo knows today about LD's zone lives in ONE place,
`.knowledge/api/snapshot-cdn.md`, and it is knowledge prose rather than checked-in state:

- zone `54b5f985b206fd11c9a53bbc59d0dc24`
- `http_request_cache_settings` ruleset `19a14f16e8464e99904a490cd8b37102`
- snapshot rule `87006fa5505749629d1600e9d38fa3e6` — `http.host eq
  "snapshots.livingdictionaries.app"` → `set_cache_settings`, cache eligible, browser TTL
  `respect_origin`, edge TTL `respect_origin`
- an OLDER sitemap/`llms.txt` rule that sits AHEAD of it, whose expression and settings are
  recorded nowhere in this repo — the single biggest unknown
- a zone-wide 4-hour Browser Cache TTL that the snapshot rule exists to override
- `.knowledge/domain/media-serving-urls.md`: `media.livingdictionaries.app` is R2-backed and its
  CORS policy is external config; a CORS change requires a cache purge

Everything else — whether `/og` is cached at the edge at all, what happens to `/api/*`, whether
the app HTML is bypassed — is unknown from the repo. A desired-state file (mirroring
`vps-setup/cloudflare/hvsb-cache-rules.json`, applied by `vps-setup/bin/cf-cache-rules`, a repo a
sibling worker owns) would need, per rule, in order: `description`, `expression`, `action`
(`set_cache_settings`), and `action_parameters` with `cache`, `browser_ttl.mode`,
`edge_ttl.mode`/`default`, plus `respect_strong_etags` where it matters — and would want to cover:

1. `snapshots.livingdictionaries.app` — respect origin at both layers (already live; transcribe it)
2. the existing sitemap / `llms.txt` rule — must be READ from the zone before writing it down
3. `media.livingdictionaries.app` — long edge TTL is correct (immutable content-hashed keys)
4. `/og` — the endpoint already sends `immutable, max-age=31536000` for a real card and
   `max-age=60` for a degraded one, so the rule must be **respect_origin**; a blanket edge TTL
   would pin a degraded generic card in front of every share of the site
5. `/api/*` and app HTML — explicit bypass, so a cache rule can never serve one user's
   authenticated JSON to another

Blocked on a token with `Zone.Cache Rules:Read` (write only when Jacob applies it). The honest
first step is a READ of the live ruleset — writing a desired-state file from repo knowledge alone
would encode a guess about rule 2 and about anything added by hand since.
