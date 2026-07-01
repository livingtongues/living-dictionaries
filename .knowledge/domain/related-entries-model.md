# Related-entries model (design rationale)

How typed relationships between entries (optionally senses) are modeled. The schema itself is in
`site/src/lib/db/schemas/dictionary.ts` (`entry_relationships`, `relationship_types`); the write
path is `site/src/lib/db/server/v1-relationship-write.ts`. This page is the *reasoning*.

> **History note.** An earlier version of this page described an unbuilt "flat entries +
> parent/child/sibling references" model (lexical variant / homonym / example-sentence as
> entry-to-entry links). That was **never implemented** — example sentences are `sense →
> senses_in_sentences → sentence`, and there was no entry-to-entry link at all until the
> `entry_relationships` feature below. Ignore the old parent/child framing.

## What was built (2026-07, `.issues/entry-relationships.md`)

**One polymorphic `entry_relationships` table**, intra-dictionary only:
- `from_entry_id` / `to_entry_id` **required**; `from_sense_id` / `to_sense_id` **optional**.
  NULL sense = the relationship is about the whole entry; set = narrowed to one meaning.
- Exactly one of `type` (a **global** slug from `RELATIONSHIP_TYPES` in `constants.ts`) or
  `custom_type_id` (→ the per-dict `relationship_types` registry) — enforced by a `CHECK`.
- Optional `note` (MultiString) + `sources` (slug[] validated against the `sources` registry).

### Why entry-ids-required + optional-sense-ids (not pure sense-to-sense)
Every entry has ≥1 sense, so *mechanically* everything could be sense-to-sense — but semantically
wrong. Whole-word relations (`cognate`, `dialectal_variant`, spelling variants, `borrowed_from`)
belong to the entry, not one arbitrary sense (especially for multi-sense entries). Meaning-level
relations (`synonym`, `antonym`, hypernym/hyponym…) want a sense. One table with nullable sense
columns expresses both; keeping the entry ids required also makes the "jump to related entry" link
and dedupe trivial. This also matches the requested POST shape.

### One row, derived inverse (not two materialized rows)
A relationship is stored ONCE. The other entry sees it by querying `to_entry_id = X` too. Global
types carry `{ symmetric, inverse_slug }`; the view renders the forward label when you're on the
`from` side and the inverse label from the `to` side. **Symmetric** types (the entire initial
global set: `synonym`, `antonym`, `cognate`, `dialectal_variant`) read identically from both sides,
so their stored endpoint order is **canonicalized** (sorted by entry_id, sense_id) — this makes
A→B and B→A dedupe to one row, and means `direction` is not meaningful for symmetric types. Global
type labels (+ inverse labels) are i18n keys `relationship_type.<slug>`; custom-type labels are
literal MultiStrings the dictionary creator authors.

### Custom types = found-or-created, like tags
`relationship_types` (per-dict) mirrors the tags/dialects pattern: deduped by name, carries a
`name` + optional `inverse_name` (directed) + `symmetric` flag. Deleting a custom type FK-cascades
its relationships.

## Surfaces
- **Write API** (agent-facing, API-key): `POST/GET /api/v1/dictionaries/{id}/relationships`,
  `DELETE …/relationships/{id}`, and `GET …/entries/{id}?include=relationships`.
- **Read display** (no in-app editing yet): `RelatedEntries.svelte` on the entry detail page
  reads the live `dict_db` and renders jump-links + the localized type label, grouped near the
  bottom. List/gallery/print/table + Orama search and an editing UI are deliberate follow-ups.

## Cross-dictionary is intentionally OUT of scope
Each dictionary is its own SQLite file (no cross-file FK / cascade / snapshot). Cross-dict linking
is a separate future subsystem — prove this intra-dict model first.
