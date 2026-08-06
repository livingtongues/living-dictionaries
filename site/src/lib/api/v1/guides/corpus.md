# Texts, interlinear glossing, and grammar

Connected material rather than isolated words: stories and passages with ordered
sentences, interlinear glossed text (IGT), and the dictionary's structured grammar
description. Read `api-basics` first if you haven't.

## Texts vs. example sentences

Two different objects, easy to confuse:

- An **example sentence** belongs to a sense — it illustrates a word. Written
  nested inside the entry (`senses[].example_sentences`) or standalone via
  `POST …/sentences` and linked by id.
- A **text** is a connected passage — a story, a narrative, a procedural
  description — with its own ORDERED list of sentences (each able to start a new
  paragraph). Independent of entries. Use the `…/texts` routes.

A sentence can be both: a text's sentence linked to a sense also serves as that
sense's example.

```
POST …/texts                    create the text with its ordered sentences
GET  …/texts                    list (filter with ?tag=<name>, exact case-insensitive)
GET  …/texts/{textId}           the text + sentences + audio + speakers in ONE call
POST …/texts/{textId}/tags      genre / motif / tale-type classification
```

## Interlinear glossed text (IGT)

Supply gold `tokens` on any sentence write shape (`SentenceInput`,
`TextSentenceInput`, `SentencePatch`). It's a map of **orthography code → ordered
token list**, usually just `default` (the vernacular line):

```json
{
  "text": "Mbwa wangu anakula",
  "translation": { "en": "My dog is eating" },
  "tokens": {
    "default": [
      { "form": "Mbwa",    "gloss": { "en": "dog" } },
      { "form": "wangu",   "gloss": { "en": "my", "default": "1SG.POSS" } },
      { "form": "anakula", "gloss": { "en": "eat", "default": "3SG.PRS" } }
    ]
  }
}
```

That token list is the **shared index** everything else aligns to 1:1 — the gloss
line, word→entry links, and karaoke audio timings. Get it right and the rest follows.

Rules worth internalizing:

- **`form` must be byte-identical to its appearance in `text`.** `start`/`end`
  offsets are optional on write; the server derives them by walking your ordered
  forms against the text with a left-to-right cursor. Strip a tone mark or footnote
  marker from the form but not the text (or vice-versa) and derivation fails.
- **The `gloss` convention is locked**: language-neutral grammatical category codes
  (`3PL`, `PFV`, `CLF`) go under the reserved `default` key; per-language lexical
  glosses (`tiger`, `虎`) under their language codes. A reader on gloss-language X
  sees `gloss[X] ?? gloss.default`, so a neutral code under `default` survives every
  gloss-language switch — putting it under `en` would make it vanish for a Chinese
  reader.
- **A token needs no entry.** `entry_id` is optional and independent of `gloss` —
  grammatical morphemes and portmanteaux often have no headword but must still be
  glossable.
- **Multi-word → one gloss** = one token spanning the whole char range.
- `status: "ignored"` marks punctuation, keeping the offset and timing arrays
  aligned.
- Legend codes are matched as a substring anywhere in a gloss cell, so portmanteaux
  like `eat PFV` still render small-caps and tap-to-expand. There's no per-token
  "is this grammatical?" flag to set.
- **Omit `tokens` entirely** and the server auto-tokenizes and word-matches for you.
  Supply them only when your source has a real glossed alignment worth preserving —
  supplied tokens default to `confirmed`.

A rows-only glossed source (aligned `[form, gloss]` rows with no separate vernacular
line) imports fine: omit `text` for that orthography and send its tokens; the server
joins the forms with spaces to build the text.

Also available per sentence: `citations` (a source ref WITH a page/example
`locator`), `example_label` (the author's own example number, e.g. `"(2a)"`), and
`discourse_role` (information/salience role, so a narrative can render foreground vs.
background). `sources.orthography` declares which script a source's forms use.

## Structured grammar

The grammar surface is live and entry-linked:

| | |
|---|---|
| `…/grammar/sections` | Hierarchical sections: parallel-language markdown prose, entry/sense links, usage conditions. A section may be headless (body-only). |
| `…/grammar/sections/{sectionId}/sentences` | Attach example sentences **by reference** — `POST …/sentences` to create, then attach the id. |
| `…/grammar/clause-slots` | Clause-template slots. |
| `…/grammar/glossing-abbreviations` | The legend that makes gloss codes expandable for readers. |
| `…/entries/{entryId}/grammar` | The reverse lookup: which grammar sections cite this entry. |

There is no separate grammar-intro endpoint — the introductory prose is simply the
first top-level section.

Fill in the **glossing abbreviations legend** whenever you import glossed material —
but ONLY for what the standard Leipzig catalog can't cover. The site already expands
every standard code (`1SG`, `PFV`, `PL` …) in every dictionary, localized into the
reader's UI language; a curated row that just restates "first person singular" adds
nothing and blocks that localization. Register a code when:

- it's outside the standard set (`1SG>2SG`, `URG.FEM`, `Ø`), or
- this language's usage genuinely differs from the standard meaning (a "dual" that
  marks two *or more*).

Wording rules for curated expansions:

- **The dictionary stands alone.** Never write "the book's X" or reference the source
  PDF — readers who never saw the source will just wonder "what book?". Source
  attribution belongs in the import report, not in gloss tooltips.
- Anchor a code to its morpheme when that identification is the point
  (`negative — the suffix -aží 'not'`), but don't echo the morpheme the reader just
  tapped on.

## The word→entry matching queue

Sentences are tokenized and matched against entries on ingest. Forms that matched
nothing, or matched ambiguously, land in the review queue at `…/suggestions`, where
they can be linked, used to create an entry, or ignored. Ignoring a form dictionary-
wide writes an `ignored_forms` row the matcher then skips. Per-token actions go
through `…/sentences/{sentenceId}/tokens/actions`.

## If a shape is awkward

This surface is newer than the rest of the API and still being shaped by real corpus
imports. If your data doesn't fit — `POST …/feedback` with `{ message }`. That
feedback genuinely changes what gets built.
