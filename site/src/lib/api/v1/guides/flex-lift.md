# Importing from FLEx / LIFT / Toolbox (SFM/MDF)

Read `/api/v1/guides/importing` first for the mandatory two-phase workflow (data preparation before any API write).

## Which export are you holding?

- **LIFT** (`.lift`, XML) — the best FLEx export format: entries, senses, examples,
  and writing systems are explicit. Prefer it when the user can re-export.
- **SFM / MDF** (`.db`, `.sfm`, `.txt` with backslash markers) — Toolbox/Shoebox and
  older FLEx exports. Line-oriented `\marker value` records separated by blank lines.
- **FLEx XML / fwdata** — full project dumps; heavier, but everything LIFT has is in
  there. Only dig in when no LIFT export is available.

## SFM/MDF marker map (the common core)

| Marker | Meaning | Maps to |
|---|---|---|
| `\lx` | lexeme (starts a record) | `lexeme` |
| `\hm` | homonym number | separate entries (keep numbering in `notes` if useful) |
| `\lc` | citation form | usually `lexeme` display form; note the difference in `notes` |
| `\a`, `\va` | allomorph / variant | `senses[].variant` |
| `\ph` | phonetic | `phonetic` |
| `\ps` | part of speech | `senses[].parts_of_speech` (opens a sense in MDF ordering) |
| `\sn` | sense number | starts a new sense under the current entry |
| `\ge` / `\gn` / `\gr` | gloss (English / national / regional) | `senses[].glosses` keyed by the right language code |
| `\de` / `\dn` | definition | `senses[].definition` |
| `\xv` | example (vernacular) | example sentence `text` |
| `\xe` / `\xn` | example translation | example sentence `translation` |
| `\sd` / `\is` | semantic domain | `senses[].semantic_domains` / `write_in_semantic_domains` |
| `\nt` / `\cmt` | notes | `notes` |
| `\se` | subentry | its own entry (link the relationship if clearly derivational) |
| `\cf` / `\mn` | cross-reference | entry relationship (or `notes` when the target is ambiguous) |
| `\dt` | edit date | ignore |

MDF hierarchy matters: markers between one `\ps`/`\sn` and the next belong to that
sense; markers before the first sense belong to the entry.

## Gotchas

- **Custom markers** (`\ph_Tor_IPA`, project-specific tags) appear in most real
  projects — map obvious ones, put the rest in `notes` rather than dropping data.
- Writing-system suffixes in LIFT (`lang="xyz-fonipa"`) tell you which orthography /
  phonetic field a form belongs to.
- FLEx POS values are often full names with hierarchies ("Noun > Proper Noun") —
  send the leaf; the API normalizes known names to abbreviations.
- Records can hold repeated markers (`\xv` … `\xv`): repeated example pairs align in
  order (first `\xv` with first `\xe`).
- Interlinear texts exported from FLEx (`\t`/`\m`/`\g` lines or flextext XML) are
  TEXTS with per-token glossing — use the `…/texts` endpoints and sentence `tokens`,
  not entries.
- **Hard-wrapped files scramble marker values**: many SFM files were word-wrapped
  by an editor, so a long value continues on bare lines below its marker — and
  sometimes the wrapped tail lands AFTER empty boilerplate markers (an empty
  `\ge`/`\gn` pair between a `\de` and its own overflow text). Before trusting
  any "unexpected" marker content, read a few occurrences in context; if it reads
  as the continuation of the previous field, glue it back on.
- **`\de` values can be glosses in disguise**: judge each value — a short
  translation equivalent ("vender.", "torre, edificio alto") belongs in
  `glosses`, while descriptive/metalinguistic prose ("prefijo verbal que
  indica…") belongs in `definition`. Put each value in ONE field (never copy to
  both), and never fabricate a gloss by truncating a definition.
