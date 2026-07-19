# Google indexing reports — 2026-07-18

Audit the Google Search Console exports in
`/home/jacob/Downloads/not-index-reasons` and determine which exclusions are intentional,
which are stale/transient, and which reveal sitemap, metadata, routing, or server defects.

## Investigation

- [x] Map each export to its Search Console exclusion reason and summarize its URL patterns. ✅
- [x] Trace sitemap generation and per-page robots/canonical behavior in the codebase. ✅
- [x] Check representative live responses, rendered metadata, redirects, and failure modes. ✅
- [x] Compare findings with current Google Search documentation. ✅
- [x] Inspect production telemetry for relevant 5xx examples if necessary. ✅
- [x] Recommend a narrowly scoped fix where evidence shows a defect. ✅
- [x] Record verification and final conclusions here. ✅

## Notes

- This is initially a read-only diagnosis. Any non-trivial implementation decision will be
  discussed after the report identifies the actual causes.
- Jacob approved implementing both cleanups on 2026-07-19.

## Implementation

- [x] Reuse one rendered-text About threshold for manager nudges, sitemap inclusion, and robots metadata. ✅
- [x] Omit thin About pages from per-dictionary sitemaps and emit `noindex` on those pages. ✅
- [x] Return a genuine 404 for unresolved dictionary slugs and access-denied secure dictionaries. ✅
- [x] Preserve canonical 301 redirects for known legacy dictionary ids/slugs. ✅
- [x] Add focused regression tests and run the relevant project verification. ✅
- [x] Update the secure-dictionary architecture note for the byte-identical 404 behavior. ✅

## Findings

### Context and sitemap health

- The sitemap/canonical launch was committed on 2026-07-09; bare dictionary URLs changed from
  redirecting to `/entries` into distinct dictionary home pages on 2026-07-10. Most duplicate
  samples were last crawled during or just before that transition.
- Live sitemap audit: 222 child sitemaps (site + 221 public dictionaries), all HTTP 200;
  270,655 unique URLs; no duplicate `<loc>` values.
- Search Console export metadata says `Sitemap,All known pages`, not that every reported URL is
  currently in the submitted sitemap. The email wording is therefore broader than the actual
  examples.

### Reason-by-reason

1. **Excluded by `noindex` (761)**
   - Private/unlisted dictionaries intentionally render `<meta name="robots" content="noindex">`.
   - They are excluded from the live sitemap by its `public = 1` query.
   - Only six exported URLs intersect today's sitemap; every one has since become public and now
     returns 200, a self-canonical, and no `noindex`. This report is expected/stale.

2. **Duplicate without user-selected canonical (127)**
   - 122 current pages return 200 with correct self-canonicals; all 122 are `/entries` pages and
     are in today's sitemap.
   - The other five are old/non-ASCII/id slugs that correctly 301 to the current slug.
   - The canonical element was added on 2026-07-09; most samples were crawled before it existed.
     Validate the fix in Search Console; no code change is needed.

3. **Duplicate, Google chose different canonical than user (22)**
   - All 22 return 200 with correct self-canonicals; 19 are `/entries`, one is a new dictionary
     home, and two are entries.
   - This is consistent with Google's duplicate cluster lag after the July 9–10 home/entries URL
     split. Current Google documentation says re-evaluation can take up to two weeks and that
     materially distinct content is what separates a cluster.
   - Do not force a different canonical yet. Inspect Google's selected canonical for one home and
     one `/entries` example after the recrawl window if this persists.

4. **Soft 404 (84)**
   - Live: 79 return 200, three 301, one 308, one 404. All 79 live pages have self-canonicals.
   - 26 of the 200 pages literally rendered `No information yet`; all were empty `/about` pages
     advertised in the sitemap before this fix.
   - Production catalog: 221 public dictionaries; 70 have empty About content, three have 1–99
     characters, 79 are below the app's existing 200-character completeness threshold, and 142
     meet it. The sitemap currently includes `/about` unconditionally.
   - **Implemented:** `/about` is included in a child sitemap only when its rendered, sanitized
     visible text meets `MINIMUM_ABOUT_LENGTH = 200`. Thin pages remain available to managers but
     emit `noindex`; the manager nudges and SEO surfaces use the same predicate.

5. **Server error 5xx (24)**
   - Every exported URL now returns 200, 301, or 404; none returns 5xx. Only one remains in today's
     sitemap and it is a clean 200/self-canonical entry.
   - Most are truncated legacy slugs, obsolete route shapes, a literal route-template URL, or a
     spam URL. No matching structured server failures remain in retained telemetry.
   - Googlebot's renderer does generate client-only noise: service-worker registration is rejected
     by WRS, and it sometimes fails to initialize the OPFS dictionary DB after SSR. Entry content
     is already in the server-rendered HTML, so this is not evidence of an HTTP 5xx. A small number
     of bot error-page sessions were observed but could not be reproduced and had no matching
     server exception; monitor rather than change code from this report.
   - **Related actionable routing defect:** a truly unknown dictionary slug previously 301ed to `/`.
     The exported spam/truncated/template URLs therefore masquerade as moved pages. Return a real
     404 for unknown slugs (and inaccessible secure dictionaries) while preserving targeted 301s
     for a known dictionary id/old slug resolving to its current canonical slug.

6. **Screenshot-only larger buckets**
   - `Discovered - currently not indexed` (113,658) and `Crawled - currently not indexed` (4,589)
     appeared immediately after exposing the full entry corpus. The live sitemap is now 270,655
     URLs, so a large discovery queue is expected. Indexing is not guaranteed; thin/duplicate
     entries may never be selected.
   - Reassess the trend after several weeks, focusing on important/rich entries rather than trying
     to force all corpus URLs into the index.

### Recommended Search Console actions

1. Deploy the implemented empty-About sitemap + robots cleanup and unknown-slug 404 behavior, then
   purge/revalidate sitemap cache.
2. Start validation now for **Duplicate without user-selected canonical** and **Server error
   (5xx)**; their exported instances are already clean. Google may also resolve them during normal
   recrawling without validation.
3. Do not validate **Excluded by noindex** as a blanket issue: it is intentional for private
   dictionaries. Spot-inspect one private and one newly-public example instead.
4. After the About cleanup, validate **Soft 404**.
5. For **Google chose different canonical**, wait through the two-week reassessment window, then use
   URL Inspection on one home and one `/entries` page to see Google's selected canonical before
   changing the architecture.

## Verification performed

- Parsed all eight Search Console export folders and all exported example URLs.
- Fetched all 222 live child sitemaps and compared their 270,655 URLs with every report.
- Fetched all 127 canonical-missing, 84 soft-404, 22 canonical-disagreement, and 24 historical 5xx
  examples as Googlebot; inspected status, redirect, robots, and canonical output.
- Queried production `shared.db` read-only for public/empty About counts.
- Queried production `logs.db` read-only for Googlebot and relevant server failures.
- Read current official Google documentation for canonicalization, soft 404s, noindex, HTTP 5xx,
  sitemap inclusion, URL Inspection, and validation.

## Implementation verification — 2026-07-19

- Full Vitest run: 238 files passed, one skipped; 1,726 tests passed, three skipped.
- Focused regressions: eight tests cover visible-text thresholding, sitemap inclusion/omission,
  unknown + blocked-secure 404s, canonical legacy redirects, and normal canonical loads.
- `pnpm lint`, `pnpm check`, and standalone `tsc --noEmit` all pass (`svelte-check`: zero errors).
- Local HTTP verification on port 3041:
  - `/achi/about` → 200 + `noindex`, no canonical; its child sitemap omits `/about`.
  - `/namtrik-de-totoro/about` → 200 + canonical, no `noindex`; its sitemap includes `/about`.
  - an unknown slug → 404 with no `Location` header.
  - `/80CcDQ4DRyiYSPIWZ9Hy/about?ref=old` → 301 to `/aonekko/about?ref=old`.
