# Final import-payload audit

`audit.py` is the fail-loud gate between an import pipeline's final payload and
its first API write. It audits the actual entries that will be posted, after
every cleanup, promotion, and expansion step.

```bash
python3 scripts/import-audit/audit.py ~/import-work/my-dict/final-entries.jsonl
```

The command exits nonzero when it finds:

- a missing/duplicate stable entry id;
- a missing lexeme;
- two NFC/casefold-equivalent spellings under an identity-bearing orthography
  without unique, non-empty `homograph` values;
- a stale or inexact collision waiver; or
- an unresolved natural-key relationship lookup.

The input may be a JSON entry array, `{ "entries": [...] }`, or JSONL with one
entry or `{ "entries": [...] }` batch per line.

Only the `default` spelling is identity-bearing by default. Pronunciation fields
are deliberately excluded: two different words with the same pronunciation are
homophones, not duplicate entries. For a dictionary with additional lexical
scripts/spelling systems, opt them in explicitly (repeat the flag as needed):

```bash
python3 scripts/import-audit/audit.py final-entries.jsonl \
  --orthography default --orthography sat-Olck
```

## Intentional unnumbered collisions

The API permits these because a few dictionaries intentionally keep one entry
per recording. Make that exceptional choice visible with a decisions file:

```json
{
  "collision_waivers": [
    {
      "orthography": "default",
      "lexeme": "example",
      "entry_ids": ["entry-uuid-1", "entry-uuid-2"],
      "reason": "The manager chose one curated recording per entry."
    }
  ]
}
```

```bash
python3 scripts/import-audit/audit.py final-entries.jsonl --decisions audit-decisions.json
```

Waivers must name exactly the current colliding ids and carry a reason. An
unused waiver fails too, so a stale decision cannot quietly outlive the data it
described.

## Relationships resolved by spelling

If a transform resolves a relationship target by headword, emit a lookup ledger
instead of silently taking the first match:

```json
{
  "source_ref": "pdf-p31-related-form-2",
  "orthography": "default",
  "lexeme": "example",
  "selected_entry_id": "entry-uuid-2",
  "resolution": {
    "target_entry_id": "entry-uuid-2",
    "reason": "Its sense is ‘to paint’; homograph 1 means ‘to lubricate’."
  }
}
```

A unique candidate needs only `source_ref`, `lexeme`, and `selected_entry_id`.
Two or more candidates require the `resolution` object shown above. When an
import links to pre-existing entries not present in the final payload, provide
those rows separately with `--relationship-candidates existing-entries.jsonl`.

```bash
python3 scripts/import-audit/audit.py final-entries.jsonl \
  --relationship-lookups relationship-lookups.jsonl \
  --relationship-candidates existing-entries.jsonl
```

Run the unit suite from the repository root:

```bash
python3 -m unittest discover -s scripts/import-audit -p 'test_*.py'
```
