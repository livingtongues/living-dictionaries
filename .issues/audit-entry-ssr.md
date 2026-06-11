# Audit — Entry-page SSR + warm-client loading + OG shareability

**Report only. No code changes.** Investigates whether entry pages SSR real content, whether shared
entry URLs get real OG images/meta, whether warm client nav pings the server, and the concrete
isomorphic fix modeled on the `house` app.

Verified empirically against the running dev server on **:3041** (an entry of the `achi` dict).

---

## TL;DR verdict

<Callout type="danger" title="Entry SSR renders a placeholder; the OG generator is dormant for entries">
SSR of an entry returns a hard-coded `"Loading..."` stub. The real entry only resolves **client-side**
from the browser wa-sqlite dict.db. So a shared/crawled entry URL serves **title = "Loading… | <Dict>
Living Dictionary"**, the **generic default description**, and **og:image = the Living Tongues logo
fallback** — never the entry's photo or gloss. Warm entry→entry nav is **already** ping-free (good),
but it pays for that by depending entirely on a fully-synced local dict.db.
</Callout>

**Empirical proof** (curl of `http://localhost:3041/achi/entry/e_ja`, `<head>`):

```
<title>Loading... | Achi Living Dictionary</title>
og:title  content="Loading... | Achi Living Dictionary"
og:image  content="https://firebasestorage.googleapis.com/.../NEW_Living_Tongues_logo_with_white_around_it.png?alt=media"
name="description" content="Language Documentation Web App - Speeding the availability of language resources…"  (the generic default)
```

The entry `e_ja` (lexeme `jaʼ`) exists in the **server** better-sqlite3 DB
(`.data/dictionaries/achi.db`, 13 entries) — so the data was available server-side and simply not read
at SSR.

---

## 1. Findings — current data flow for an entry

### The relevant SvelteKit doc rules (quoted)

- A universal `load` in `+page.js` **"runs both on the server and in the browser"**; a `+page.server.js`
  load **"should *always* run on the server… accesses a database."** (Loading data → Page data)
- Rerun rules (Loading data → *When do load functions rerun?*):
  - *"It references a property of `params` whose value has changed"*
  - *"It calls `await parent()` and a parent `load` function reran"*
  - *"A child `load` function calls `await parent()` and is rerunning, and the parent is a server load
    function"*
  - In the blog example: *"the one in `+layout.server.js` will not [rerun], because the data is still
    valid"* when only the child `[slug]` param changes.
- Server loads & `__data.json`: a universal load running in the browser that needs server-load output
  pulls it via a `__data.json` request; **eliminating the server load at a level removes that ping for
  nav at that level.** (This is exactly what the house refactor exploited — see §3.)

### The four loads in play for `/[dictionaryId]/entry/[entryId]`

| File | Kind | Reads | Reruns when… |
|---|---|---|---|
| root `+layout.server.ts` | server | auth/session (SSR user) | session/parent change (sibling-agent scope) |
| `[dictionaryId]/+layout.server.ts` <File path="site/src/routes/[dictionaryId]/+layout.server.ts" /> | **server** | `params.dictionaryId` → `get_dictionary_by_url_or_id` against **shared.db** (better-sqlite3) | `params.dictionaryId` changes (dict→dict), or invalidateAll |
| `[dictionaryId]/+layout.ts` <File path="site/src/routes/[dictionaryId]/+layout.ts" /> | universal | opens browser wa-sqlite dict.db via SharedWorker, builds `entries_data` (EntryData read-model), `search_entries`, roles | `await parent()` reran, or `depends(DICTIONARY_UPDATED_LOAD_TRIGGER)` invalidated |
| `entry/[entryId]/+page.ts` <File path="site/src/routes/[dictionaryId]/entry/[entryId]/+page.ts" line="5" /> | universal | the entry, from `entries_data` (client only) | `params.entryId` changes, or parent reran |

There is **no `+page.server.ts`** in the entry route (confirmed).

### What `+page.ts` actually does (the crux)

<File path="site/src/routes/[dictionaryId]/entry/[entryId]/+page.ts" line="5" />

```ts
const loading_entry = { id, main: { lexeme: { default: 'Loading...' } }, senses: [{}] } as EntryData
if (!browser) {
  // SSR: render a placeholder; client hydrates from local dict.db.
  return { entry_from_page: loading_entry, shallow: false }
}
const { entries_data } = await parent()
await /* entries_data.loading === false */   // waits for the whole dict bundle to load
const derived_entry = derived([entries_data], ([$d]) => $d[entry_id] ?? loading_entry)
return { derived_entry, shallow: false }
```

- **On the server (SSR):** returns `entry_from_page = {lexeme:'Loading...'}`. No DB read. The comment
  even says: *"A server-SQLite SSR read for SEO can be a follow-up."*
- **On the client:** ignores `entry_from_page`, awaits `parent()` (the dict `+layout.ts`), **blocks on
  `entries_data.loading`** — i.e. waits for the entire dict read-model (`read_dict_bundle` → Orama/
  EntryData, per the database skill's read-model caveat) to be assembled from the local wa-sqlite
  dict.db — then resolves the entry by id.
- `+page.svelte` <File path="site/src/routes/[dictionaryId]/entry/[entryId]/+page.svelte" line="21" />:
  `const entry = $derived(entry_from_page || $derived_entry)`. At SSR/hydration `entry_from_page` is
  truthy (the stub), so the page shows "Loading…" until the client load replaces it with `derived_entry`.

### Step-by-step

<Steps>
  <Step title="SSR (server)">dict `+layout.server.ts` reads the **catalog row** from shared.db (real dictionary name/coords). The entry `+page.ts` returns the **"Loading…" stub** — no entry read. HTML ships with placeholder title/og.</Step>
  <Step title="Hydration (client)">`+page.ts` reruns in the browser, opens/awaits the dict wa-sqlite store, blocks on `entries_data.loading`, resolves the real entry, swaps it in. First real paint waits on the snapshot download + sync of the whole dict.db.</Step>
  <Step title="Warm entry→entry nav">Only `params.entryId` changed. `+layout.server.ts` does NOT rerun (dictionaryId unchanged → no `__data.json`). `+layout.ts` does not rerun (parent didn't, trigger not invalidated; connection cached on globalThis). `+page.ts` reruns **client-side only**, reads `entries_data` from the parent cache. → <b>zero server pings.</b></Step>
  <Step title="dict→dict nav">`params.dictionaryId` changed → `+layout.server.ts` reruns → one `__data.json` for the new catalog row (expected/necessary).</Step>
</Steps>

### Explicit answers

- **Is SSR of entry content happening?** ❌ No. SSR returns a `"Loading..."` placeholder; the entry
  resolves only client-side from wa-sqlite.
- **Are shared links getting real OG images?** ❌ No. og:image is the default logo; title is "Loading…".
- **Does warm nav ping the server?** ✅ No (for entry→entry within a dict). The current architecture
  *already* meets the "warm client doesn't ping" goal for the entry route — because there's no
  `+page.server.ts` and the dict `+layout.server.ts` is keyed on `dictionaryId` (unchanged). The cost
  is the failure on the SSR/SEO side.

---

## 2. OG / shareability verdict

**Is the OG generator "in action" for entries? No — it's dormant.** The machinery is fully built and
wired, but it's fed the placeholder at SSR, so it never triggers.

Trace:

- `+page.svelte` <File path="site/src/routes/[dictionaryId]/entry/[entryId]/+page.svelte" line="79" />
  passes `imageTitle={entry.main.lexeme.default}` (= `"Loading..."`),
  `imageDescription={seo_description({ entry, … })}` (empty/generic for the stub), and
  `gcsPath={entry.senses?.[0]?.photos?.[0]?.serving_url}` (= `undefined` for the stub).
- `SeoMetaTags.svelte` <File path="site/src/lib/components/SeoMetaTags.svelte" line="66" />:
  `imageUrl = gcsPath ? '/og?props=…' : DEFAULT_IMAGE`. With `gcsPath` undefined → **`DEFAULT_IMAGE`**
  (the Living Tongues logo). So `/og` is **never called** for an entry.
- `/og/+server.ts` <File path="site/src/routes/og/+server.ts" line="9" /> + `OpenGraphImage.svelte` are
  healthy: given real props they render a 1200×630 PNG (entry photo via lh3, or a globe + title +
  gloss). They just never receive real props for entries.

**What a shared link currently produces vs should:**

| Consumer | Now | Should |
|---|---|---|
| FB / Twitter / Slack / iMessage (no JS) | title "Loading…", generic description, logo image | lexeme + gloss title, gloss/POS description, the entry's photo (or globe) OG card |
| Googlebot (renders JS) | *can* eventually index the hydrated entry, but only after downloading + syncing the whole dict.db and clearing the JS render budget — fragile for deep links | real content already in the SSR HTML |

User-visible consequence: **every shared entry link looks identical and broken** ("Loading…" + logo) in
any unfurl preview, regardless of which word was shared. The OG image generator — the whole point of
making entries shareable — does nothing for the entry route today.

---

## 3. Recommendation — isomorphic entry load, mirroring `house`

### The house pattern (verified, read-only)

house deleted `[reference]/+layout.server.ts` and made a **single universal `+layout.ts`**
<File path="../house/site/src/routes/[version]/[bookId]/[reference]/+layout.ts" /> that:

- builds content **locally when warm** (cached CSV for scripture; local reader DB for media), and
- calls a **`/api/chapter` `+server.ts`** <File path="../house/site/src/routes/api/chapter/+server.ts" />
  via the **load's injected `fetch`** *only* on SSR + the cold warm-up window.

The `_call.ts` <File path="../house/site/src/routes/api/chapter/_call.ts" /> takes the **load's `fetch`**
(not `post_request`) precisely so that — per the SvelteKit docs — on SSR the endpoint resolves
**in-process** (no real HTTP) and the response is **reused from the HTML during hydration** (no refetch).
Warm client nav builds everything locally → **zero network**. The `reader-db` store's **`synced` flag**
<File path="../house/site/src/lib/db/client/reader-db.svelte.ts" line="72" /> lets an empty local read be
**trusted as genuinely empty** (don't ping) vs *not-yet-synced* (fall back to the endpoint). The shared
builders are pure so SSR output and client output are byte-identical → **no hydration mismatch**. (Written
rationale: `house/.issues/bible-csv-isomorphic-reader.md`, `reader-isomorphic-media-load.md`.)

### Applying it to LD's entry route

The server already can read the entry: `get_dictionary_db(dict_id)` (better-sqlite3) + `query_one` from
`typed-query.ts` (database skill §Server-side queries). The dict catalog row is *already* SSR-resolved.
The only missing piece is **assembling the entry's `EntryData` server-side** the same way the client's
`read_dict_bundle`/`init_entries` does (lexeme + senses + glosses + first photo serving_url + POS), so the
SSR-built entry matches the client-built one.

**Proposed shape (analyze the ping tradeoff — see below):**

1. **New endpoint** `src/routes/api/dictionary/[id]/entry/[entryId]/+server.ts` (+ `_call.ts`) — GET,
   public (entries are URL-reachable per `get-dictionary.ts`), returns the assembled `EntryData` for one
   entry from the per-dict better-sqlite3 DB. Mirror house's `_call.ts` taking the **load's `fetch`**.
2. **Rewrite `entry/[entryId]/+page.ts`** as the isomorphic load:
   - **SSR + cold window:** call the endpoint via `fetch` → real `EntryData` → real OG meta on first
     paint. (In-process on SSR; reused-from-HTML on hydration.)
   - **Warm client:** read the entry from the local dict store (`entries_data[entry_id]`, or
     `dict_db.entries.id(entry_id)`); only fall back to the endpoint while not yet synced (LD's analog of
     the `synced` flag — see open question).
   - Drop the `entry_from_page` "Loading…" stub; `+page.svelte` should render from the single resolved
     `entry`.
3. **`+page.svelte`/`SeoMetaTags`** then receive a real entry at SSR → `gcsPath` populated → `/og`
   generates the real card; title/description real.

```diff-ts
 // entry/[entryId]/+page.ts  (sketch — not applied)
-if (!browser) return { entry_from_page: loading_entry, shallow: false }
-const { entries_data } = await parent()
-/* block on loading, derive */
+const warm = browser && /* entries_data synced */ entries_data_value[entry_id]
+const entry = warm ?? await get_dict_entry({ fetch, dict_id, entry_id })  // endpoint on SSR/cold
+return { entry, shallow: false }
```

### The ping tradeoff for THIS route (important nuance)

Two ways to get SSR content:

- **(A) `+page.server.ts`** (read better-sqlite3 directly in a server load). Simplest to write, but a
  server load **keyed on `params.entryId`** *reruns on every warm entry→entry nav* → a `__data.json`
  ping each time. **This directly violates Jacob's "warm client must not ping the server" goal.** ❌
- **(B) universal `+page.ts` + `+server.ts` endpoint** (the house shape). SSR resolves in-process (fast,
  no extra hop); hydration reuses the HTML; **warm nav reads local wa-sqlite and never calls the
  endpoint.** ✅ This is the recommended shape, *because* within a dict `dictionaryId` is constant but
  `entryId` changes — exactly the case where a per-entry server load would ping on every nav.

So: **don't use `+page.server.ts` here.** Keep the universal load; add the public endpoint.

### Hydration-mismatch risk

The SSR-built entry (from better-sqlite3 via a server assembler) and the client-built entry (from
wa-sqlite via `read_dict_bundle`/EntryData) **must serialize identically**, or Svelte will warn/repaint.
Mitigation mirrors house's "pure shared builder": factor the EntryData assembly into one shared function
used by both the new endpoint and the client read path (or have the warm client briefly trust the SSR
`entry` until its local store is ready, then swap without layout shift). Validate by diffing SSR HTML vs
hydrated DOM for a known entry.

### The "load the whole dict for one shared entry" concern

Today a cold visitor to a deep entry link must download the **entire dict.db R2 snapshot** and sync before
the entry even appears (the `+page.ts` blocks on `entries_data.loading`; biggest dicts here are 6k–10k
entries — e.g. `torwali` 9908, `nukuoro` 6613). For a one-off shared link that's heavy and slow.

The endpoint approach fixes the **first-paint/SEO** half immediately: the server renders just that one
entry (one `query_one` + a few child queries), so the crawler/first paint never waits on the snapshot.
**Option to consider:** for a cold deep-link visitor, render the single entry from the endpoint and
**defer / make optional** the full dict.db download (only fetch the whole snapshot when they navigate into
the entries list or start editing). That keeps shared links instant without forcing a multi-MB download to
view one word. (Decision for Jacob — see below.)

---

## 4. Open questions for Jacob

<Question id="server-assembler" prompt="Build a shared server-side EntryData assembler (lexeme+senses+glosses+first photo+POS) from the per-dict better-sqlite3 DB, reused by the new endpoint?" mode="single">
  <Choice value="A" recommended>Yes — one pure assembler shared by SSR endpoint + client read path (house's anti-mismatch pattern)</Choice>
  <Recommendation>Guarantees SSR and client entries serialize identically; minimal duplication.</Recommendation>
  <Choice value="B">Reuse/port the client `read_dict_bundle` logic server-side as-is</Choice>
</Question>

<Question id="shape" prompt="Confirm the SvelteKit shape for the entry route?" mode="single">
  <Choice value="A" recommended>Universal +page.ts + public /api/dictionary/[id]/entry/[entryId] endpoint (no +page.server.ts)</Choice>
  <Recommendation>Avoids the per-entry __data.json ping on warm nav; SSR still resolves in-process.</Recommendation>
  <Choice value="B">+page.server.ts reading better-sqlite3 directly</Choice>
  <Recommendation>Simplest, but reruns + pings on every warm entry→entry nav — conflicts with the stated goal.</Recommendation>
</Question>

<Question id="cold-deep-link" prompt="For a cold visitor to a shared deep entry link, should we defer the full dict.db snapshot download (render just the one entry from the server first)?" mode="single">
  <Choice value="A" recommended>Yes — server-render the single entry; download the full dict.db lazily (on entering the list / editing)</Choice>
  <Recommendation>Makes shared links instant; avoids multi-MB downloads (torwali ~9.9k, nukuoro ~6.6k entries) to view one word.</Recommendation>
  <Choice value="B">No — keep eagerly downloading the whole dict.db on any entry visit (status quo for warmth)</Choice>
</Question>

<Question id="synced-flag" prompt="Add a house-style `synced` flag to the dict store so a warm-but-not-yet-synced empty/missing entry falls back to the endpoint instead of flashing 'not found'?" mode="single">
  <Choice value="A" recommended>Yes — distinguish 'genuinely missing' from 'not synced yet'</Choice>
  <Recommendation>Prevents an empty-result flash on the warm-up window; matches reader-db.svelte.ts:72.</Recommendation>
  <Choice value="B">No — block on entries_data.loading as today (but then can't avoid the full download)</Choice>
</Question>

<Question id="private-dicts" prompt="OG/SSR for private (non-public) dictionaries — render real entry content server-side too, keeping noindex?" mode="single">
  <Choice value="A" recommended>Render real content for everyone (anonymous-reachable per get-dictionary.ts), keep `norobots` for private dicts</Choice>
  <Recommendation>Matches existing access model (public flag governs listing, not viewing); SEO already gated by norobots.</Recommendation>
  <Choice value="B">Only SSR-render content for public dictionaries</Choice>
</Question>

---

## Appendix — file map

- Entry load (placeholder): `site/src/routes/[dictionaryId]/entry/[entryId]/+page.ts`
- Entry view + SEO wiring: `site/src/routes/[dictionaryId]/entry/[entryId]/+page.svelte`
- Dict catalog SSR (works): `site/src/routes/[dictionaryId]/+layout.server.ts`
- Dict client store / wa-sqlite open: `site/src/routes/[dictionaryId]/+layout.ts`
- SEO meta + og:image fallback: `site/src/lib/components/SeoMetaTags.svelte`
- OG image endpoint + component: `site/src/routes/og/+server.ts`, `site/src/routes/og/OpenGraphImage.svelte`
- Server dict read helpers: `site/src/lib/db/server/dictionary-db.ts`, `get-dictionary.ts`, `typed-query.ts`
- House reference: `house/site/src/routes/api/chapter/{+server,_call}.ts`,
  `house/site/src/routes/[version]/[bookId]/[reference]/+layout.ts`,
  `house/site/src/lib/db/client/reader-db.svelte.ts`
