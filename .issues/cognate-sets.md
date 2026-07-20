# Etymon / cognate-set object (design capture — build when prioritized)

Source: agent feedback thread `cf6809b0-1c26-495d-8c61-9cb3b41fb003` (River, 2026-07-18, gap 3;
marked resolved 2026-07-19). Sibling of `.issues/comparative-dialectology.md` (PARKED) — same
comparative-linguistics family, and an isogloss/cognate view there would consume this model. This one
is spec'd deeper because an importer has concrete data waiting (dry-run-mapped multi-dialect import).

## Problem

Pairwise `cognate` entry-relationships can't express "these N entries are reflexes of reconstruction
\*X (proto-level Y)": you'd need O(N²) links, and the reconstruction itself isn't an entry (it's not a
word in any documented variety, so it has no home). Current fallback: prose in each entry's
`linguistic_history`.

## Proposed model (dict.db, both tables syncable)

```
cognate_sets
  id            text PK
  reconstruction text          -- the proto-form, e.g. "*ʔuŋ" (plain string; MultiString unnecessary —
                               -- a reconstruction is one form, not per-locale text)
  proto_level   text           -- e.g. "Proto-Hmong-Mien", "Proto-Western-Hmongic"
  gloss         json MultiString  -- the reconstructed meaning, per gloss language
  notes         json MultiString
  sources       json string[]  -- sources.slug refs (validated, integrity-swept like entries)
  citations     json SourceCitation[]  -- {slug, locator} once entry-level citations land
  + dirty/server_seq/created_*/updated_* per convention

cognate_set_members
  id         text PK
  set_id     text FK → cognate_sets CASCADE
  entry_id   text FK → entries CASCADE
  sense_id   text FK → senses SET NULL (optional narrowing)
  note       text               -- per-reflex note ("irregular tone reflex")
  + sync columns; UNIQUE(set_id, entry_id)
```

- An entry can belong to multiple sets (compounds, doublets).
- Keep pairwise `cognate` relationships as-is — they remain right for two-dict/two-entry links;
  sets are the N-ary + reconstruction-bearing layer. No migration of existing relationships.

## API sketch (v1, per parity direction — one shared server module for API + future UI)

- `GET/POST …/cognate-sets` (list w/ pagination; create takes members inline:
  `{ reconstruction, proto_level, gloss, notes, sources, citations, members: [{entry_id, sense_id?, note?}] }`,
  client ids honored for idempotency like entries).
- `GET/PATCH/DELETE …/cognate-sets/{setId}` (PATCH field-merge; members upsert by entry_id;
  DELETE tombstones set + members).
- Entry reads gain `cognate_sets: [{id, reconstruction, proto_level}]` when non-empty.
- Bulk-friendly: creation inline-with-members already makes one set one call; if ledgers demand it,
  the `.issues/v1-bulk-ops.md` array-with-per-item-results pattern extends naturally.

## UI sketch (later phase, keep small)

- Entry page: a "Cognate set" block — reconstruction + proto-level + linked member entries.
- A set page (or modal) listing reflexes across dialects; natural hook for the comparative-
  dialectology isogloss view later (plot members at their dialect localities).

## Status

Design validated against the schema conventions 2026-07-19 (junction/tombstone/MultiString/sources
patterns all have precedents). **Not scheduled** — pick up after the current quick-wins/bulk-ops
waves, or when the River importer is ready to ship its comparative index.
