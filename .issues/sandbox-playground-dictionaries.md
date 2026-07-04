# Sandbox / playground — let people play without creating junk dictionaries

## The problem

Of 2,232 production dictionaries, ~1,600 are cruft: explorers who created a dict and moved on
(650 now in the `delete` bucket), self-declared conlangs (696), and classroom/study glossaries
(269). Every one of these minted a real catalog row, a per-dict SQLite file, an R2 snapshot slot,
and full GCS media-upload rights. The create form's conlang checkbox proves people *tell us*
they're playing — we just don't give them a playground, so they play in production.

## What the architecture already gives us

The local-first stack makes a **zero-server playground** unusually cheap:

- The per-dict DB already lives client-side (wa-sqlite in OPFS, leader worker,
  `$lib/db/dict-client/`). A dict that never registers server-side is just an OPFS file whose
  sync engine never runs.
- `fetch-snapshot.ts` seeds a dict from a `.db.gz` — it can seed from a **bundled static asset**
  just as easily as from R2 (header normalization already handled).
- Dev already mocks media end-to-end (`DEV_LOCAL_PREFIX` sentinel + `/api/dev-media` +
  `image_src()` branching) — the same pattern extends to a `playground-local:` sentinel resolved
  to blob/object URLs from blobs stored beside the OPFS DB.
- `memory-connection.ts` exists as a no-OPFS fallback, so even old Safari can play (loses data on
  reload, which is fine for a toy).

## Options

### A. Local-only playground dictionary (RECOMMENDED core)

"Try Living Dictionaries" button (homepage / create-dictionary page) → opens `/playground` using
the SAME entry-editing components, backed by a dict DB that exists only in this browser.

- **No shared.db row, no server sync, no GCS.** `open_dict` gets a `local_only` flag: skip
  snapshot fetch from R2 (seed from bundled sample), never construct the sync engine.
- **Seeded, not empty**: bundle a small curated sample (~30–50 entries with glosses, a few
  photos/audio referencing existing PUBLIC dict media URLs — no new storage) so the first
  impression is a working dictionary, not a blank table. A "reset playground" button re-seeds.
- **Banner**: "This playground lives only on this device." Storage cleared = gone, and that's OK.
- **Route/meta**: `[dictionaryId]` layout expects a catalog row; `/playground` provides a
  synthetic in-memory dict meta (name "My Playground", editable gloss languages) instead.
- **Media**: uploads write blobs to OPFS next to the DB; `storage_path` gets a
  `playground-local:` prefix; `image_src`/audio-url helpers branch on it (same shape as the
  existing dev-media mock).

### B. "Graduate to real" conversion path (phase 2 of A)

When a playground user is serious: they fill the real create-dictionary form → we register the
dict server-side → client re-points the OPFS file to the new dict_id, marks all rows dirty, sync
pushes everything up. Media blobs upload through the normal presign flow at graduation time.
This makes the playground the DEFAULT starting point without punishing genuine communities.

### C. Server-side sandbox with TTL (alternative to A)

Real dict rows flagged `bucket = 'sandbox'`-ish, media uploads disabled, auto-torn-down after
30–60 days of inactivity (batch driver on the existing teardown endpoint). Cheaper to build
(no local-only plumbing) but keeps minting server rows/files, keeps the catalog polluted until
the sweeper runs, and "your dictionary was deleted" emails are worse than "this playground lives
on your device".

### D. Create-time routing + bucket stamping (cheap, do regardless)

- The create form ALREADY asks "is this a conlang?" — when checked, stamp `bucket = 'conlang'`
  at create time (no admin triage needed) and show "conlangs are welcome but media storage is
  disabled — consider the playground".
- Add a "just exploring? try the playground" interstitial before the create form.
- Optionally require admin approval only for going PUBLIC (already effectively true).

### E. Demo dictionary tour (complement, not substitute)

A read-only, well-curated public demo dict + a guided tour overlay ("this is an entry, here are
senses, here's audio…"). Good marketing, but doesn't satisfy the "let me type my own words" itch
that produces junk dicts — pair it with A rather than replacing it.

## Recommendation

**A + D now, B when A proves itself, E later as marketing polish.** A kills the junk-creation
incentive at the root (playing is genuinely nicer in the playground: instant, offline, no
account needed), D stops new conlangs/glossaries from landing unclassified, and B protects real
communities from any friction.

## Implementation sketch for A (rough)

1. `PLAYGROUND_DICT_ID` constant; `open_dict(PLAYGROUND_DICT_ID, { local_only: true })` — skip
   R2 snapshot + sync engine construction; seed from `static/playground-seed.db.gz`.
2. `/playground` route: synthetic dict meta + the existing entries table/list + entry detail
   components mounted on `page.data.dict_db` as usual.
3. Media upload branch: blob → OPFS `playground-media/` dir + `playground-local:` storage_path
   sentinel; URL helpers resolve sentinel → object URL.
4. No auth requirement at all (rows stamp a placeholder user id; audit columns don't matter
   locally).
5. Curate + build the seed snapshot (script in `scripts/`), bundle in `static/`.

## Open questions for Jacob

- Playground per browser (one shared scratch dict) or allow multiple playground dicts?
- Should the playground be reachable ANONYMOUSLY (no login)? (Recommend yes — biggest funnel win.)
- Does graduation (B) need admin approval, or self-serve like today's create form?
