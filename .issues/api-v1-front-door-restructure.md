# v1 API restructure — task-routing front door, guides as the primary layer, reference last

Invert the agent's first contact with `/api/v1`. Today an agent is told to fetch
`openapi.json` first (**207 KB ≈ 52k tokens**) and the pointer to the guides —
the thing it actually needs — is buried in section 13 of 15 in `info.description`.
After this: a ~3 KB task-routing front door → the guide for its job → the reference
only when it's ready to write. The human page at `/admin/api-docs` becomes a route
tree that mirrors those exact hops (a nav click == the agent's next fetch).

Decisions locked with Jacob 2026-07-27 (all 7 questions answered A).

## Measurements taken before the work (dev server, 2026-07-27)

| fetch | bytes |
| --- | --- |
| `openapi.json` (default today) | 207,507 |
| `openapi.json?tag=entries` | 99,386 ← "slice" is 48% of the spec |
| `openapi.json?view=index` | 16,327 |
| `guides/importing.md` | 48,690 |

`filter_openapi_by_tag` keeps **all** component schemas so `$ref`s resolve — that's
why a tag slice is nearly half the spec. Needs a reachable-ref walk.

## Target journey

```
GET /api/v1                        ~3 KB   what this is · auth · PICK YOUR JOB · reference pointers last
  └─ GET /api/v1/guides/{task}             the runbook for the job at hand
       └─ GET /api/v1/openapi.json?tag=…   schemas, only when ready to write
```

Human mirror, same hops, live-loaded from those same endpoints:

```
/admin/api-docs                    task menu cards → buttons
  └─ /admin/api-docs/guides/[slug]
       └─ /admin/api-docs/reference        (the index view)
            └─ /admin/api-docs/reference/[tag]
/admin/api-docs/schemas
```

Every human page carries an "agent call" strip: `GET /api/v1/guides/importing` +
copy-as-curl, so the page reads as the agent transcript.

## Decisions

1. **Front door = `GET /api/v1`, content-negotiated.** Serve HTML **only** when the
   `Accept` header explicitly lists `text/html` (browsers do); everything else —
   bare `curl`, Python `requests` (both send `Accept: */*`) — gets JSON. Also honor
   `?format=json` / `?format=html` as an explicit override. Both renderings derive
   from ONE object so they can't drift.
2. **Six tasks**: `import` · `cleanup` · `consume` · `media` · `corpus` · `ask-us`.
   `import` is listed first and loudest (the common case).
3. **Key-optional personalization.** No key → static, cacheable. Valid
   `Authorization: Bearer ldk_…` → add a `dictionary` block (name, gloss languages,
   orthographies, entry_count, scope read|write) and a `suggested_task` with a
   one-line `because`. Resolves via `verify_api_key({ db, token })` which already
   returns `{ dictionary_id, role, key_id, created_by_user_id }` — no dictionary id
   needed in the path. An invalid/revoked key must NOT 401 the front door; just
   fall back to the anonymous doc (agents will paste junk keys).
4. **`info.description`'s 15 `##` sections move into guides**; it shrinks to ~10
   lines (what this is · auth one-liner · "you should have come from `GET /api/v1` —
   read your task guide first" · how to slice this doc).
5. **`openapi.json` default → the compact index**; `?view=full` for everything;
   `?tag=` pruned to reachable schemas. `?view=full` is a permanent free escape
   hatch (costs one param, handicaps nothing).
6. **Human docs = route tree**, admin-only for now but built so it lifts to a public
   `/api-docs` with no rework (no admin-only assumptions in the components).
7. `importing.md` stays ONE 49 KB document — an agent that has committed to an
   import needs the whole phased runbook; splitting invites skipping Phase 1.

## Work

### A. Front door

- ✅ NEW `site/src/lib/api/v1/front-door.ts` — the single source of truth.
  - `TASKS` constant: `{ id, title, when, guides: string[], next: [{ method, path, why }] }`
    for the six tasks. `when` is the "is this you?" line an agent matches against.
  - `build_front_door({ origin, context? })` → the JSON doc:
    `{ what, auth, tasks, reference: { index, by_group, full, tag_names }, dictionary?, suggested_task? }`.
  - `suggest_task({ entry_count, unlinked_file_count, open_conversation_count, scope })`
    → `{ task_id, because }`. Rules: read-only scope → `consume`; open import
    conversation or unlinked uploaded files → `import`; `entry_count === 0` →
    `import`; otherwise → `cleanup`.
- ✅ NEW `site/src/lib/api/v1/front-door-html.ts` — renders the SAME object to the
  small HTML page (replaces the hand-written HTML currently inlined in `+server.ts`,
  which duplicates spec prose and will drift).
- ✅ REWRITE `site/src/routes/api/v1/+server.ts` — negotiate, optionally resolve the
  key, delegate to the two renderers. Cache-Control: `public, max-age=300` when
  anonymous, `no-store` when personalized.
- ✅ Add `/api/v1` itself to the OpenAPI `paths` (new tag `start`, listed first) so
  an agent that lands on the index cold still sees "start here".

### B. Guides become the primary layer

Current: `importing`, `spreadsheets`, `flex-lift`, `pdf-scans`, `snapshot`.
Target: `api-basics`, `importing`, `spreadsheets`, `flex-lift`, `pdf-scans`,
`cleanup`, `consume`, `media`, `corpus`.

- ✅ NEW `api-basics.md` ← from `info.description`: Auth · The dictionary id ·
  Multilingual fields · Data model · Limits · Clients · Fetching the spec
  (progressive disclosure). This is the "read this once" guide every task links to.
- ✅ NEW `cleanup.md` ← seeded by `info.description` §"Edits & deletes" (the
  single-row fixes: `PATCH`/`DELETE …/sentences/{id}`, `DELETE …/senses/{id}`,
  tag/dialect rename-vs-unlink) + auditing recipes (find entries missing glosses,
  the `review` flag workflow, dedupe by lexeme, `?elicitation_id=`).
- ✅ RENAME `snapshot.md` → `consume.md`, absorbing `info.description` §"Bulk reads
  — dictionary snapshots". Update every reference to the `snapshot` slug
  (`openapi.ts` info prose, the old `/api/v1` HTML, `GUIDE_DESCRIPTIONS`).
- ✅ NEW `media.md` ← `info.description` §"Media (audio / photos / videos)" +
  attribution rules (`speaker_id` / `source` slug), the media-request flow, and
  forced alignment / karaoke timings (`alignment` tag endpoints).
- ✅ NEW `corpus.md` ← `info.description` §"Structured grammar + interlinear
  glossing (IGT)" + texts/sentences/tokens/suggestions.
- ✅ `guides/index.ts`: extend `GUIDE_DESCRIPTIONS` (ordered), update the docblock
  ("format-import guides" → "task playbooks"), update the two tests including the
  hardcoded slug array.
- ✅ No `ask-us` guide — that task's `next` is just `POST …/feedback` and the
  conversations endpoints.

### C. Reference layer

- ✅ `lib/api/v1/openapi.ts`
  - shrink `info.description` to the ~10-line stub.
  - `select_openapi_view`: **no params → index**; `view=full` → whole spec;
    `view=index` still works; `tag=` unchanged entry point.
  - `filter_openapi_by_tag`: walk `$ref`s transitively from the kept paths and keep
    ONLY reachable `components.schemas`. Target ≤ 25 KB for `tag=entries`.
  - `build_openapi_index` description gains the front-door pointer.
- ✅ `routes/api/v1/openapi.json/+server.ts` — docblock + `view=full` passthrough.

### D. Agents page

- ✅ `lib/components/settings/AgentPrompt.svelte` — "Full reference (fetch this
  first): …/openapi.json" → "Start here (fetch this first): `{origin}/api/v1`".
  Keep the dictionary id + auth lines. This is the change that makes the whole
  restructure reachable; without it the front door is a welded-shut lobby.

### E. Human route tree (`routes/admin/api-docs/`)

- ✅ `+page.ts` fetches `/api/v1` with `Accept: application/json`; `+page.svelte`
  renders the task menu as cards, each with a primary button to its guide page and
  secondary links to its `next` calls. Personalization block hidden here (no key).
- ✅ `guides/+page.*` (catalog) + `guides/[slug]/+page.ts|.svelte` — one guide, markdown rendered (reuse
  `render_markdown_to_html` + `sanitize_rich_text`), with a section TOC from
  `split_markdown_sections` and prev/next guide links.
- ✅ `reference/+page.ts|.svelte` — the `?view=index` doc, grouped by tag, each tag
  linking to its page.
- ✅ `reference/[tag]/+page.ts|.svelte` — `?tag=<name>`, full ops (move the existing
  operation-rendering markup out of the current monolith).
- ✅ `schemas/+page.ts|.svelte` — the component schemas (from `?view=full`).
- ✅ NEW `agent-call.svelte` (+ `inline-code.svelte`, `operation-view.svelte`) — the "your agent fetches: `GET …`" strip + copy-curl.
- ✅ Keep `schema-view.svelte` + `helpers.ts` (still used); delete the parts of
  `+page.svelte` that the split obsoletes. `build_tag_groups`/`split_markdown_sections`
  stay.

### F. Tests + verification

- ✅ `front-door.test.ts`: JSON shape; **size budget ≤ 4 KB** anonymous; every task's
  guide slug exists in `list_guides()`; every task's `next.path` matches a path in
  the OpenAPI spec (catches drift when a route is renamed); `suggest_task` table.
- ✅ `openapi.test.ts`: default view is the index; `view=full` returns the full spec;
  **every `$ref` in a `?tag=` slice resolves** after pruning; per-tag size budget.
- ✅ Guides index test: new slug list.
- ✅ `pnpm test` (2119 pass), `tsc`, `pnpm lint`, `svelte-check` (0 errors) all clean.
- ✅ Screenshot all admin pages (dev-auth skill for an admin session) — task
  menu, a guide, reference index, a tag page, schemas. Light + dark.
- ✅ curl matrix against dev: `/api/v1` with no Accept, `Accept: text/html`,
  `Accept: application/json`, `?format=html`, valid key, revoked key, junk key.

## Backwards compatibility

Endpoints, request bodies, response shapes and status codes are **untouched**. Two
observable changes:

- `GET /api/v1/openapi.json` (no params) → compact index. Fails LOUDLY (missing
  `components.schemas`) for anyone generating a client from it; fix is `?view=full`,
  which stays permanently.
- `GET /api/v1` returns JSON to non-browser clients.

Jacob has a user with a Python test suite hitting the endpoints directly — that
suite is unaffected. A short heads-up note was drafted for him in chat (framed as
"the entry point moved", not an apology). Deliberately NOT keeping the 207 KB doc as
the default to protect it.

## Notes for a resuming session

- `verify_api_key({ db: get_shared_db(), token })` (`$lib/api-keys/api-key`) is the
  key→dictionary resolver; `verify_dict_api_access` is the per-route gate and is NOT
  what the front door wants (it demands a dictionary in the path).
- The old `/api/v1` HTML page has import/pdf-scan prose that is ALREADY duplicated in
  the guides — migrate nothing verbatim, just delete once the guides cover it.
- `tag_for_path` derives every operation's tag from its path; a new `start` tag needs
  a branch there.

## Results (2026-07-27)

| fetch | before | after |
| --- | --- | --- |
| first read an agent is told to make | 207,507 B (`openapi.json`) | **6,504 B** (`GET /api/v1`) |
| `openapi.json` default | 207,507 B | 16,900 B (compact index) |
| `openapi.json?tag=entries` | 99,386 B | 55,151 B (30 schemas, not 60) |
| `openapi.json?view=full` | n/a | 194,497 B |

Guides went 5 → 9 (`api-basics`, `importing`, `spreadsheets`, `flex-lift`,
`pdf-scans`, `cleanup`, `consume`, `media`, `corpus`).

Verified: `pnpm test` 2119 pass · `tsc` clean · `pnpm lint` clean · `svelte-check`
0 errors · content-negotiation curl matrix (bare curl / `Accept: */*` / browser
Accept / `?format=` overrides / valid key / junk key / JWT-shaped bearer) all 200
with the right content-type and cache-control · screenshots of all 6 admin pages in
light + dark.

## Gotchas hit

- **`Accept: */*` inside a JSDoc block comment closes the comment** (`*/`) and the
  route 500s with a `[PARSE_ERROR] Unexpected token` from vite:oxc. Reworded, don't
  reintroduce.
- **`tw-prose` prints literal backticks around inline `code`** (Tailwind default in
  `typography.css`). Unreadable for a code-dense guide, so the guide page overrides
  `code::before/::after { content: none }` **scoped to itself** — the global rule
  serves manager-authored entry notes and must stay.
- The front-door JSON landed at 6.5 KB, not the 4 KB first guessed; the `when`
  routing lines are the whole point, so the test budget is 8 KB.
- ESLint has two rules that fight over `expect(a < b).toBe(true)` vs
  `toBeLessThan` — assert an exact `Object.keys()` order array instead.

## Not done / possible follow-ups

- The human docs stay admin-only. Lifting to a public `/api-docs` (or linking from
  each dictionary's Agents page) is now a move, not a rewrite.
- `?tag=entries` is still 55 KB because `EntryInput`/`EntryFull` descriptions are
  long prose. If it matters, the next lever is trimming those descriptions, not the
  slicing.
- Jacob to decide whether to send the Python-test user the heads-up note drafted in
  chat (endpoints unchanged; only `openapi.json`'s default view moved).
