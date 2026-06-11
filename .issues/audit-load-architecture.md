# Audit — site-wide load / server-ping / invalidation architecture

**Type:** report-only (no code changes). Breadth sweep across the whole app; a sibling agent
deep-dives the entry route + OG. Author: audit agent, 2026-06-07.

**Goal (Jacob):** "Proper usage of load functions, interaction of client/server/api endpoints. Make
sure SSR loading is solid, while also once the client is warm, the server is not pinged anymore."

**Yardstick (house app):** warm client nav should make **zero** server fetches; SSR speed unchanged.

---

## TL;DR

LD is already in **good shape** for the "quiet when warm" goal — **better than the house starting
point.** Within-dictionary navigation (entries ⇄ entry ⇄ about ⇄ grammar ⇄ settings) makes **no
`__data.json` ping at all**, because the only server load in that subtree
(`[dictionaryId]/+layout.server.ts`) keys on `params.dictionaryId`, which doesn't change. Verified
empirically against the running dev server (port 3041).

The remaining server round-trips are:
1. **dict → dict** navigation (re-reads the catalog row) — 1 ping. 🟡 necessary, could be silenced.
2. **contributors / invite** page-server loads — 1 ping **per visit**. 🟡 necessary read, repeat
   visits could be cached.
3. **auth changes** (`invalidateAll()`) — 1 ping **plus 2 extra client API fetches** (re-fetches the
   global public-dictionaries list + my-dictionaries). 🔴 over-broad.
4. **about / grammar catalog edits** call `invalidateAll()` where the scoped
   `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` would do. 🔴 over-invalidation.

SSR is solid for catalog-backed pages (about, grammar, contributors, invite). It is a **no-op
placeholder** for the local-first per-dict content pages (entry, entries list) and the home list,
because that content lives in browser wa-sqlite, not on the server. That's a deliberate design
tradeoff, but it is an SEO gap (entry detail covered by the sibling agent).

---

## Grounding — the SvelteKit rules this audit relies on

Quoted from the official docs fetched via the `svelte` skill (`kit/load`, `kit/$app-navigation`):

- **Server loads only run on the server.** "Server `load` functions _always_ run on the server."
  Therefore, when a server load must re-run during client-side navigation, the browser cannot run it
  — SvelteKit issues a `GET …/__data.json?x-sveltekit-invalidated=…` request so the server re-runs it.
  This `__data.json` ping is the "server got pinged" signal we're hunting.
- **A server load re-runs when** "it references a property of `params` … whose value has changed" /
  a `url` property it read changed / a `depends()` URL was `invalidate()`d / `invalidateAll()` ran.
- **Parent/child coupling:** "A `load` function that calls `await parent()` will also rerun if a
  parent `load` function is rerun," **and** (key for this codebase) "**A child `load` function calls
  `await parent()` and is rerunning, and the parent is a server load function**" → the parent server
  load re-runs too. So a universal child that `depends()` on a trigger drags its server parent (and a
  `__data.json` ping) along when that trigger fires.
- **Search params tracked independently:** reading `url.searchParams.get('x')` only re-runs on `x`
  changes, not other params.
- **`invalidate(url)`** re-runs only loads that depend on that url/key (via `fetch`/`depends`).
  **`invalidateAll()`** re-runs *every* active load (incl. the root layout server + universal).
- **Relative `fetch()` in a load** calls the `+server.ts` handler **directly** (no HTTP), and the
  SSR response is inlined into the HTML and re-read on hydration (no second network request). This is
  why the house pattern (endpoint + universal load) keeps SSR fast while going quiet when warm.

### Empirical confirmation (dev server on :3041)

`curl …/__data.json` exposes each node's tracked `uses`:

| Route | node 0 (root layout.server) | node 1 (`[dictionaryId]/+layout.server`) | leaf |
|---|---|---|---|
| `/` (root) | `uses: {}` | — | — |
| `/<dict>/entries` | `uses: {}` | `uses: {params:['dictionaryId']}` | `null` (no server load) |
| `/<dict>/contributors` | `uses: {}` | `uses: {params:['dictionaryId']}` | `uses: {dependencies:['contributors:reload'], parent:1}` |

`uses: {}` on the **root** layout server proves it re-runs **only** on `invalidateAll()` — never on
plain navigation. The dict layout server's `{params:['dictionaryId']}` proves it re-runs **only**
when the dict slug changes (or `invalidateAll`). Both confirmed against the code trace below.

---

## 1. Inventory

### Server loads

| Route file | Reads | Re-runs on which nav | `__data.json` ping? | Verdict |
|---|---|---|---|---|
| `+layout.server.ts` (root) | `cookies` (session JWT, locale), `accept-language`, `cf-ip{lat,long}` headers | **only** `invalidateAll()` (auth). `uses:{}` — never on plain nav | only on auth invalidation | 🟢 correctly scoped; JWT verify + shared.db user lookup are server-only |
| `[dictionaryId]/+layout.server.ts` | `params.dictionaryId` → `get_dictionary_by_url_or_id` (shared.db, better-sqlite3) | **dict→dict** + `invalidateAll` | yes, on those | 🟡 must be server (better-sqlite3 + redirect on unknown slug); candidate for endpoint+universal+cache |
| `[dictionaryId]/contributors/+page.server.ts` | `params.dictionaryId` via `parent()`, `depends('contributors:reload')`; reads roles/invites/partners from shared.db | **every visit** to the tab; `contributors:reload`; parent re-run; `invalidateAll` | yes, per visit | 🟡 necessary shared.db read; repeat-visit pings cacheable |
| `[dictionaryId]/invite/[inviteId]/+page.server.ts` | `params.inviteId` + parent dict; reads `invites` from shared.db | visit to invite page; `invalidateAll` | yes, per visit | 🟢 rare, low-traffic; fine |

### Universal loads

| Route file | Work | Re-runs on | Server ping itself? | Verdict |
|---|---|---|---|---|
| `+layout.ts` (root) | reads `?lang` + server `data`; builds translator; sets `auth_user`/`dict_roles` from `ssr_user`; **creates `create_dictionaries_store()` + `create_my_dictionaries_store()`** (client fetches), `preferred_table_columns` | `?lang` change; parent server re-run; `invalidateAll` | no (but recreates stores → 2 client API fetches on every re-run, see F3) | 🟡 |
| `[dictionaryId]/+layout.ts` | `depends(TRIGGER)`; `await parent()`; computes role/`can_edit`; opens dict wa-sqlite via SharedWorker (cached on `globalThis`); **recreates `create_entries_ui_store(...)`**; exposes `dict_db`, `update_dictionary` | dict→dict; `invalidate(TRIGGER)`; `invalidateAll` | drags server parent (node 1) → ping | 🟡 dict conn cached, but `entries_ui` re-instantiated each run (F4) |
| `[dictionaryId]/+page.ts` | `redirect → /<dict>/entries` | — | — | 🟢 |
| `[dictionaryId]/entries/+page.ts` | creates `createQueryParamStore({key:'q'})` once | parent re-run | no | 🟢 content is client-side (Orama/dict.db); `?q` handled reactively by the store, **no load re-run on query change** |
| `[dictionaryId]/entry/[entryId]/+page.ts` | `params.entryId`; SSR returns `"Loading…"` placeholder; client derives entry from `entries_data` store | entry→entry (client only) | **no ping** (universal) | 🟢 for ping / 🔴 SSR placeholder (sibling agent) |
| `[dictionaryId]/entries/[redirectId]/+page.ts` | redirect to `/entry/[id]` | — | — | 🟢 |
| `[dictionaryId]/about/+page.ts` | returns `update_about()` closure → `api_dictionaries_catalog` + `invalidateAll()` | parent re-run | no (but F1) | 🔴 `invalidateAll` over-broad |
| `[dictionaryId]/grammar/+page.ts` | same as about → `invalidateAll()` | parent re-run | no (but F1) | 🔴 `invalidateAll` over-broad |
| `[dictionaryId]/settings/+page.ts` | returns closures over `update_dictionary` (→ `invalidate(TRIGGER)` in layout) | parent re-run | no | 🟢 (uses the scoped trigger — good) |
| `[dictionaryId]/contributors/+page.ts` | returns edit closures → `invalidate('contributors:reload')` | parent re-run | no | 🟢 scoped invalidate |
| `[dictionaryId]/invite/[inviteId]/+page.ts` | `({data}) => data` re-expose of server load | — | — | 🟢 |
| `+page.ts` (home `/`) | returns lazy `get_public_dictionaries`/`get_private_dictionaries` getters using injected `fetch('/api/dictionaries?…')` | — | n/a (lazy, called from component) | 🟡 raw `fetch`, not a `_call`; SSR list weak (F6) |
| `globe/+page.ts` | `await fetch('/api/dictionaries?visibility=public')` (injected fetch) | — | SSR direct-handler | 🟡 raw `fetch` not `_call`; SSR'd (globe canvas, SEO N/A) |
| `create-dictionary/+page.ts` | returns `create_dictionary` / `dictionary_id_exists` closures (use `_call`) | parent re-run | no | 🟢 |
| `admin/+layout.ts` | `await parent()`; admin gate (403); opens admin wa-sqlite + `Sync` (cached on `globalThis`) | parent re-run; `invalidateAll` | no | 🟢 client-only DB; gates correctly |
| `admin/+page.ts` | redirect → `/admin/messages` | — | — | 🟢 |
| `setlocale/[bcp]/+page.ts` | returns `{bcp}` | params | no | 🟢 |

### Routes with NO page load (render off layout data only)

`/about`, `/account`, `/dictionaries`, `/terms`, `/tutorials`, `/[dictionaryId]/export`, `/import`,
`/synopsis`, and all `admin/*` leaf pages. These ride `page.data` from the layouts → no extra
server round-trips on navigation to them. 🟢

### Endpoints (`+server.ts`) + `_call.ts` coverage

All `api/*` endpoints follow the `_call.ts` convention **except** the public dictionaries list, which
is hit via raw `fetch('/api/dictionaries?visibility=…')` from `+page.ts` (home), `globe/+page.ts`,
and `create_dictionaries_store` / `create_my_dictionaries_store` in `lib/dictionaries.ts`. `og/+server.ts`
is a direct image URL (no `_call`, correct). `hooks.server.ts` `handle` is a pass-through (it only
forces shared.db open + migrations at boot); **no auth/handle-level guard** — auth is resolved in the
root `+layout.server.ts`.

---

## 2. Findings

### F1 🔴 over-invalidation — about/grammar catalog edits use `invalidateAll()`
<File path="site/src/routes/[dictionaryId]/about/+page.ts" line="13" /> and
<File path="site/src/routes/[dictionaryId]/grammar/+page.ts" line="13" /> call `invalidateAll()` after
a catalog save. The dict layout already exposes `update_dictionary()`
(<File path="site/src/routes/[dictionaryId]/+layout.ts" line="90" />) which uses the **scoped**
`invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` and is used by settings. `invalidateAll()` additionally
re-runs the **root** layout server + root universal load, which **re-fetches the global
public-dictionaries list and my-dictionaries** (F3). The scoped trigger still re-runs the dict
`+layout.server.ts` (via the await-parent rule) so the new `about`/`grammar` text refreshes — just
without nuking the root. Blast radius today: whole tree; should be: dict subtree.

### F2 🟡 `DICTIONARY_UPDATED_LOAD_TRIGGER` works only because of the await-parent rule
`depends(DICTIONARY_UPDATED_LOAD_TRIGGER)` lives on the **universal**
<File path="site/src/routes/[dictionaryId]/+layout.ts" line="24" />, but the authoritative catalog
row comes from the **server** `+layout.server.ts` (which does *not* `depends()` on the trigger).
Catalog fields still refresh after `invalidate(TRIGGER)` **only** because the universal child calls
`await parent()`, so SvelteKit re-runs the server parent too (and pings `__data.json`). This is
correct but subtle — worth a one-line comment in the server layout, or moving the `depends()` there,
so a future edit doesn't "optimize away" the parent and silently break catalog refresh.

### F3 🟡 auth invalidation re-fetches the global dictionaries lists every time
Every `invalidateAll()` (login, logout, dev-admin toggle, Google One Tap, invite accept) re-runs the
root `+layout.ts`, which **re-creates** `create_dictionaries_store()` and
`create_my_dictionaries_store()` (<File path="site/src/lib/dictionaries.ts" line="11" />,
<File path="site/src/lib/dictionaries.ts" line="30" />). Each new `readable` immediately
`fetch('/api/dictionaries?visibility=public')` and `/api/me/dictionaries` again on the client. So an
auth change costs: 1 `__data.json` ping (root + dict server loads) **+ 2 client API fetches** even
though the public list rarely changes. `my_dictionaries` seeds from localStorage (good) but still
re-fetches; the public list has no cache at all. Callers:
<File path="site/src/lib/auth/user.svelte.ts" line="58" />,
<File path="site/src/lib/components/shell/AuthModal.svelte" line="54" />,
<File path="site/src/lib/components/shell/User.svelte" line="31" />,
<File path="site/src/lib/auth/google-one-tap.ts" line="55" />,
<File path="site/src/lib/components/LoginModal.svelte" line="18" />.

### F4 🟡 `entries_ui` store re-instantiated on every dict-layout re-run
<File path="site/src/routes/[dictionaryId]/+layout.ts" line="84" /> calls
`create_entries_ui_store(...)` on **every** layout re-run — i.e. on each `invalidateAll()` (auth
changes) and each dict→dict nav. The dict `connection`/`dict_db` are cached on `globalThis` and
survive, but the surrounding UI/search store is rebuilt. Confirm whether this re-instantiation
re-reads the dict bundle / re-seeds Orama (potentially expensive on big dicts) or is cheap. If
expensive, it should be cached alongside the connection on `globalThis` and only `set_user_id`-
refreshed, mirroring how `dict_db` is handled.

### F5 🟡 contributors/invite page-server loads ping on every visit
<File path="site/src/routes/[dictionaryId]/contributors/+page.server.ts" line="12" /> and
<File path="site/src/routes/[dictionaryId]/invite/[inviteId]/+page.server.ts" line="13" /> read
shared.db and re-run (→ `__data.json`) on **every** navigation to the tab — including navigating away
and back. Within an otherwise-quiet dict, repeatedly toggling to Contributors is the one in-dict
action that keeps pinging. Necessary today (shared.db is server-only for non-admins), but a prime
candidate for the house pattern (endpoint + universal load + a small client cache keyed by dict_id)
so repeat visits read warm. (Invite is low-traffic — leave it.)

### F6 🔴/context — weak/no SSR on local-first content pages
SSR renders **real** content for catalog-backed pages — about, grammar (folded onto the catalog row
in `+layout.server.ts`), contributors, invite (shared.db). Verified: `/<dict>/about` SSR contains the
about text. SSR is a **placeholder/no-op** for:
- **entry detail** — returns a `"Loading…"` stub on the server
  (<File path="site/src/routes/[dictionaryId]/entry/[entryId]/+page.ts" line="13" />); hydrates from
  browser wa-sqlite. *(Sibling agent's deep-dive — flagged here for completeness; the code comment
  even notes "A server-SQLite SSR read for SEO can be a follow-up.")*
- **entries list** — content comes from the client Orama index / dict.db; SSR shows shell only.
- **home `/`** — `+page.ts` returns lazy getter functions, so the dictionary list is fetched
  client-side; the list is not in the SSR HTML.

This is inherent to the per-dict local-first model (content lives in browser wa-sqlite). But the
server **can** read dict content (`get_dictionary_db()` / better-sqlite3 exists), so an SSR read for
entry/entries is technically possible for SEO — a deliberate roadmap decision, not an accidental bug.

### F7 🟢/minor — raw `fetch` bypassing the `_call.ts` convention
Home `+page.ts`, `globe/+page.ts`, and `lib/dictionaries.ts` call
`fetch('/api/dictionaries?visibility=…')` directly instead of via a `_call` wrapper
(api-endpoint skill says always use `_call`). In loads this uses the injected `fetch` (fine,
direct-handler on SSR), but it sidesteps the typed contract + single grep-able call site. Low
priority; a `api_dictionaries_list(visibility)` `_call` would tidy all three.

### Boundary check — clean
No universal load imports `node:*`, `$env/dynamic/private`, or better-sqlite3.
`[dictionaryId]/+layout.ts` imports `$env/static/public` (`PUBLIC_STORAGE_BUCKET`) — public, fine.
All in-load API fetches use the injected `fetch` with **relative** URLs (direct-handler optimization
preserved). Server-only work (JWT verify, shared.db reads, redirects on unknown slug) is correctly
confined to `+layout.server.ts` / `+page.server.ts`. No leaks found.

---

## 3. Recommendations (prioritized)

**APPROVED to act on:**

1. **(F1, easy win — APPROVED clean-cut)** Switch about/grammar `invalidateAll()` →
   `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` (the same scoped trigger settings already uses).
   Eliminates the root re-run + the 2 redundant client API fetches on every long-form catalog edit.
   SSR impact: none.
2. **(Q1 dict→dict catalog — APPROVED: CONVERT)** Convert `[dictionaryId]/+layout.server.ts` to the
   house endpoint+universal+cache shape: a per-dict cache map (`globalThis.__ld_catalog[url_or_id]`,
   matched on both `url` and `id`) read first by a universal load, with a `GET
   /api/dictionaries/[id]/catalog` **fallback** for cache misses (private/unlisted dicts not in the
   public store). Wire cache invalidation to `DICTIONARY_UPDATED_LOAD_TRIGGER` so edits stay fresh.
   Keep the redirect-on-unknown-slug server-reachable. SSR impact: none (direct-handler call). Full
   shape + caveats in §4. dict→dict to a seen/public dict → zero ping.
3. **(F5, medium — house pattern)** Move the **contributors** server load behind an
   `/api/dictionaries/[id]/contributors` endpoint + a universal `+page.ts` that calls it on SSR/cold
   and reads a per-dict client cache when warm. Repeat visits to the tab go quiet; SSR stays fast
   (relative `fetch` → direct handler, inlined into HTML). Leave invite as-is (low traffic).
4. **(F2, tiny)** Add a comment (or move `depends(TRIGGER)` onto the server layout) so the
   catalog-refresh-via-await-parent coupling is explicit and not accidentally broken.
5. **(F7, cleanup)** Add a `api_dictionaries_list(visibility)` `_call` and route the three raw
   `fetch('/api/dictionaries')` sites through it.

**Decided NOT to act on (Jacob, 2026-06-07):**

- **(F3 — LEAVE)** The public-dictionaries refetch on each auth change stays. Auth changes are
  infrequent; the simplicity is worth more than the saved 2 fetches.
- **(F4 — LEAVE)** `create_entries_ui_store` re-instantiation assumed cheap; not cached.
- **(F6 — sibling agent)** entry/entries server-SSR-for-SEO decision belongs to the entry-route +
  OG deep-dive, not this sweep.

**Net:** within-dict nav is already quiet. Items 1–3 remove the last avoidable warm-state server
chatter (over-broad catalog invalidation, dict→dict catalog reads, contributors repeat-pings)
without touching SSR latency.

---

## 4. Jacob's decisions (2026-06-07)

- **Q1 (dict→dict catalog): CONVERT** to the endpoint+universal+client-cache shape (see the
  refined-shape callout in §3 item 3 — a per-dict cache map with an endpoint fallback, NOT a naive
  read of the public store, because that store omits private/unlisted dicts).
- **Q2 (F4 entries_ui re-instantiation): LEAVE** — assume cheap, don't cache it. F4 downgraded to
  "noted, no action."
- **Q4 (F3 public-list refetch on auth): LEAVE** — the per-auth-change refetch stays. F3 downgraded
  to "noted, no action."
- **F6 (entry/entries SSR for SEO):** owned by the sibling agent (entry route + OG deep-dive). Not
  decided here.

### Dictionaries-store reference (context for the Q1 conversion)

Two client stores, both built in root `+layout.ts`, exposed on `page.data`
(<File path="site/src/lib/dictionaries.ts" />):

| Store | `page.data` key | Backing fetch | Contents |
|---|---|---|---|
| `create_dictionaries_store()` | `page.data.dictionaries` | `GET /api/dictionaries?visibility=public` (browser-only) | **all public dicts** |
| `create_my_dictionaries_store({user_id})` | `page.data.my_dictionaries` | `GET /api/me/dictionaries`, **localStorage-seeded** | user's dicts (+ role), incl. their private ones |

Shapes are compatible: the list endpoint runs `SELECT * FROM dictionaries WHERE public = 1` → projects
to `DictionaryView`, which is `InferSelectModel<dictionaries> & {created_by,updated_by}` — i.e. the
**full catalog row**, the same `SELECT *` the dict layout server's `get_dictionary_by_url_or_id()`
returns. So `DictionaryView ⊇ DictionaryRow`.

**Caveats the Q1 conversion MUST handle (why a naive "just read the public store" breaks):**
1. The public store is `WHERE public = 1`, but **every** dict is URL-reachable; the layout resolves
   private/unlisted dicts too → those are **absent** from `page.data.dictionaries` (a cache miss).
   `my_dictionaries` covers the user's own private dicts but not an arbitrary one (admin browsing /
   shared private link).
2. The layout resolves **url-first then id** → the cache lookup must match on both `url` and `id`.
3. Freshness: the list is fetched once per session/invalidateAll; catalog edits must invalidate the
   cache (tie into `DICTIONARY_UPDATED_LOAD_TRIGGER`) or `name`/`about` go stale.

→ Therefore the conversion is a per-dict cache map (e.g. `globalThis.__ld_catalog[url_or_id]`),
populated as dicts are visited (+ optionally seeded from the public store), read first by a universal
load, with a `GET /api/dictionaries/[id]/catalog` **fallback** on miss (direct-handler on SSR, the
only ping when warm). dict→dict to an already-seen/public dict → **zero ping**; to a brand-new private
dict → 1 unavoidable ping.
