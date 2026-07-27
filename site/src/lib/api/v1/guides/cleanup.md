# Cleaning up an existing dictionary

Auditing, correcting, normalizing, deduplicating, or extending entries that are
already there. Read `api-basics` first if you haven't.

The governing rule: **a dictionary is a community's record of its own language, not
a dataset to tidy.** An oddity is far more often a real linguistic fact than a
mistake. Before any sweeping change, show your human a sample and get agreement —
especially anything touching spelling, diacritics, or word division.

## 1. Look before you touch

Page the whole dictionary in one sweep — `?include=senses` batches the senses in, so
you don't need per-entry fetches:

```
GET …/entries?include=senses&limit=500&offset=0
```

Rows come back ordered by `updated_at ASC` with `has_more` telling you to bump
`offset`. Other filters: `lexeme=` (substring; add `match=exact` for an exact match
against any locale's spelling), `elicitation_id=` (exact), `updated_since=` (ISO,
exclusive — the incremental re-read).

Read them **by eye**, in bulk, not just programmatically. Print a few hundred rows
and actually look. Programmatic checks find what you thought to check for; looking
finds what you didn't.

## 2. Common audits

| Audit | How |
|---|---|
| Entries with no gloss in a language | Sweep with `?include=senses`, check each sense's `glosses` for the code |
| Duplicate headwords | Group by the `default` value of `lexeme`; genuine homographs should carry a `homograph` number instead of being merged |
| Gloss language mislabeled | Whole-dictionary read, then eyeball whether the text under `en` is actually English |
| Headword accidentally inside the gloss | Look for the lexeme repeating at the start of its own gloss (a classic parser artifact) |
| Orphaned/stale rows from an old import | `updated_since` + the `import_id` private tag on the batch |
| Provenance gaps | `sources` comes back on every list row — find entries with none |

Distinguish **deterministic fixes** (a parser artifact you can prove, applied
uniformly) from **judgement calls** (is this a typo or a dialect spelling?). Do the
first, queue the second.

## 3. Queue the judgement calls instead of guessing

Set the entry's `review` field — an editor-only flag that puts the entry in the
manager's "Needs review" queue and is **never** shown to the public:

```json
{ "review": { "category": "uncertain_gloss", "note": "The source gives 'kola' for both 'to dig' and 'to plant'. Which is right for this entry, or are these two senses?" } }
```

- `category` is a free label that drives the review-queue facet — reuse a small
  consistent vocabulary across one job (`truncated`, `headword_in_gloss`,
  `uncertain_gloss`, `missing_gloss`, `other`).
- `note` must be answerable **from the entry page alone**, in plain language,
  ending in a concrete question. No code paths (`glosses.gn`), no parser jargon, no
  "check the source file".
- Use it for genuinely unresolved questions — not as an audit log of transformations
  you already completed correctly.

Clear it by sending `"review": null`. A human clears it by clicking Resolve.

## 4. Surgical, single-row fixes

For one typo you do **not** rewrite the entry. Read the ids from the entry read
shape (`senses[].id`, `senses[].sentences[].id`, `tags[].id`, `dialects[].id`) and
hit the dedicated route:

| Fix | Call |
|---|---|
| Correct one example sentence | `PATCH …/sentences/{sentenceId}` |
| Remove one example sentence | `DELETE …/sentences/{sentenceId}` |
| Remove one sense | `DELETE …/senses/{senseId}` (refused for an entry's LAST sense — delete the entry instead) |
| Rename a tag/dialect **everywhere** | `PATCH …/tags/{tagId}` · `PATCH …/dialects/{dialectId}` |
| Delete a tag/dialect **everywhere** | `DELETE …/tags/{tagId}` · `DELETE …/dialects/{dialectId}` |
| Unlink a tag/dialect from ONE entry | `DELETE …/entries/{entryId}/tags/{tagId}` · `…/dialects/{dialectId}` |
| Remove an entry entirely | `DELETE …/entries/{entryId}` (takes its senses with it) |

Note the rename/unlink distinction: `PATCH …/tags/{tagId}` changes the label on
every entry carrying it; `DELETE …/entries/{entryId}/tags/{tagId}` removes it from
one entry while it survives elsewhere.

## 5. PATCH semantics — merge, never delete

`PATCH …/entries/{entryId}` **field-merges**: fields you send overwrite, fields you
omit stay.

- `senses` are a true upsert by client `id` — a known id field-merges that sense; an
  unknown id (or none) creates a sense WITH that id, so deterministic import ids keep
  addressing the same sense across re-syncs. An id belonging to a *different* entry
  is a `400`.
- Language keys **overlay**: sending one gloss language leaves the others untouched.
  Send `""` to drop one language, `null` to clear a whole field.
- `sources` and `citations` **merge** (union) — patching one source never drops
  another.
- `parts_of_speech` / `semantic_domains` are **replaced** outright.
- `dialects` / `tags` are **added, never removed** by a PATCH — use the unlink
  routes above.
- Example sentences upsert by id; `{ "id": "…" }` alone links an existing sentence
  without rewriting it.
- `coordinates` is **replaced** wholesale — send `null` to clear, omit to leave.

**Re-syncing a corrected source therefore leaves stale rows behind.** PATCH updates
what you send but never removes the sense, sentence, or tag that vanished from your
source. Remove those explicitly with the DELETE routes.

## 6. Undoing a bad import

Every bulk import is stamped with a private tag named after its `import_id`, which
makes the whole batch removable:

```json
POST …/entries/batch-delete   { "import_id": "my-import-2026", "dry_run": true }
→ { "count": 1827, "sample_entry_ids": ["…"] }

POST …/entries/batch-delete   { "import_id": "my-import-2026", "confirm_count": 1827 }
```

Two-step by design: the dry run writes nothing, and the real run must echo the count
back. A mismatch is a `409` — so a stale script can't nuke a batch that has since
been re-imported. The emptied private tag is deleted too; orphaned standalone example
sentences are left behind.

## 7. Report back

When you finish, tell your human what you changed in their terms — how many entries
touched, what categories of fix, what you left in the review queue and why. If you
hit a wall or an awkward shape, `POST …/feedback` with `{ message }`; it reaches the
Living Dictionaries team directly and genuinely shapes what we build.
