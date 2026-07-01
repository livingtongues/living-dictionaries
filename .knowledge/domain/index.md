# domain/ — app-domain knowledge

Durable knowledge about the Living Dictionaries *domain* and external services it leans on —
the stuff you can't learn by reading one file. The data model itself lives in `AGENTS.md`
("Domain data model") and the schemas in `site/src/lib/db/schemas/`.

## Pages
- [related-entries-model.md](./related-entries-model.md) — why related entries use flat
  parent/child/sibling references instead of nested sub-entries, and the per-type editing rules.
- [orthographies-model.md](./orthographies-model.md) — the alternate-writing-system registry:
  immutable `code` keys, why `lexeme.default` stays the primary, the Keyman dataset (and the live-API
  subset gotcha), custom-code rules, and human/agent parity.
- [media-serving-urls.md](./media-serving-urls.md) — how GCS storage paths become image/audio
  URLs, and the App Engine Images `lh3` magic-URL resize/crop spec the photo pipeline depends on.
- [dictionary-import-process.md](./dictionary-import-process.md) — the human + script process for
  importing a dictionary from the Google Sheets template (dev dry-run → prod → make public).
- [change-history.md](./change-history.md) — the server-side per-dict audit log (entry/text/sentence
  edit timelines): where capture hooks in, the separate `{id}.history.db` + owners-index shape, how it
  survives schema drift, the entry≠text attribution boundary, and the red-phase correctness bugs.
