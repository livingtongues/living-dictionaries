# LD grammar-spec REVIEW — the IGT / sentence-layer gap (chunk 3) — ✅ SENT 2026-07-14

**Context:** LD's app-dev agent turned our grammar feedback (chunk 1) into a *draft* grammar/corpus
API (all `x-status: draft`, 404 until built) and asked us — through Jacob — to review whether it
covers what we need to import structured grammar/corpus data. The three spec snapshots it sent live
at `ld-import/data/grammar-draft-spec/openapi-{index,grammar,full}.json`.

**Grounding read (2026-07-14):**
- Draft spec: `GrammarSectionInput/Full` (hierarchy: `parent_id`, `after_section_id`, `number_label`,
  `title`+`body`+`usage_conditions` MultiString, `slot_id`, `entry_id`+`sense_id`,
  `example_sentence_ids`), `ClauseSlot*`, `GrammarIntroPatch`, `SectionSentenceRef`,
  `…/entries/{id}/grammar` reverse, `TextTagInput` (`kind` motif/genre/tale_type + `code`),
  `SentenceDiscourseFieldDraft` (`discourse_role`), `SourceScriptFieldDraft` (`orthography`).
- LD clone `site/src/lib/db/schemas/dictionary.types.ts` — `SentenceToken { form, start, end,
  entry_id?, sense_id?, candidates?, status? }`. **No gloss field.** `SentenceTokens = Record<orth,
  SentenceToken[]>`. `MediaTimings = Record<sentenceId, "off,dur|off,dur">` (word karaoke).
- LD clone `dictionary.ts` — `sentences { text, translation, text_id, sort_key, ends_paragraph,
  sources[], tokens }`. `entries.interlinearization` is a text field ON THE ENTRY (headword
  morphology), NOT a per-example gloss line.
- Draft `SentenceInput` (write shape) = `{ id, text, translation, sources }` only — **`tokens` are
  NOT writable**; they are auto-matched server-side.
- Our real data: `research/{white-2014,birnschein-2019,mclaughlin-2013,riddle-1993}/examples.jsonl`
  — ~1050 interlinear examples, each `{hmong, gloss, en/ft, rows:[[word,gloss]…], cite}`. Classic
  IGT.

---

## Verdict in one line

**The grammar-SECTION layer is well-shaped and covers everything I asked for. The gap is one layer
DOWN, in the `sentences` model the sections reference: it cannot represent interlinear glossed text
(IGT) — the single most-imported format in descriptive linguistics — because a sentence/token has no
aligned GLOSS line, and tokens aren't writable.** Since sentences/texts/grammar are all greenfield,
now is the moment to make the sentence a first-class IGT unit.

## What the section layer got right (acknowledge these — no changes needed)

Maps 1:1 to what we accumulated across a pedagogical handbook guide, three descriptive theses, and a
single-relativizer paper:
- **Hierarchy + parallel language** — `parent_id`/`after_section_id`/`number_label`,
  `title`/`body` MultiString. ✅ (our sources are numbered trees, often matched zh+en.)
- **Section ↔ entry both ways** — `entry_id`+`sense_id` on the section, `…/entries/{id}/grammar`
  reverse. ✅ (a section usually *is* one particle's usage doc.)
- **Examples by reference** — `example_sentence_ids` + `…/sections/{id}/sentences`. ✅ (one sentence
  = text line + sense example + grammar evidence at once.)
- **Usage conditions** as their own block — ✅ (the whole relativizer paper is usage conditions).
- **Clause-template slots** — `ClauseSlot*` + `slot_id`. ✅ (the theses order particles by a clause
  template; this renders it.)
- **Discourse role** on a sentence (`discourse_role` enum: storyline/backgrounded/flashback/setting/
  evaluation/reported_speech). ✅ (the discourse/salience thesis needs exactly this.)
- **Text classification tags** (`kind` motif/genre/tale_type + controlled `code`). ✅ (folktale
  collection ships a Stith-Thompson motif index.)
- **Per-source orthography** (`SourceScriptFieldDraft`). ✅ (our corpus spans RPA, a pinyin-style
  romanization, and idiosyncratic phonetic transcriptions.)

## What IGT is, and why it's the keystone

Interlinear Glossed Text (governed by the **Leipzig Glossing Rules** — the de-facto universal
standard) presents an example as **aligned tiers**:

```
1)  Lawv   tau      ntshai.          ← object / vernacular line
    3PL    ATT      afraid           ← morpheme-by-morpheme GLOSS line (grammatical = SMALL CAPS)
    'They were afraid.'              ← free translation
```

The **gloss line** is the analytical content — the reason the example exists. Lexical morphemes get
a lowercase gloss (`afraid`); grammatical morphemes get a category label (`3PL`, `ATT` = attainment,
`CLF`, `PFV`, `NEG`). Every one of our ~1050 examples IS this. In the current model there is nowhere
to put the gloss line: `text` holds the object line, `translation` holds the free translation, and
`tokens` hold word→entry links — but **no token or sentence field holds the aligned gloss**. Importing
these examples today would discard their entire analytical value, leaving vernacular + free
translation (i.e. not a grammar example at all).

IGT import is one of the most-requested capabilities for *any* language-documentation platform
(FLEx, ELAN, Toolbox, Typecraft, interlinear glosser tools all center it). Getting it right here
makes LD a serious home for descriptive linguists, not just wordlists.

## The gap — concrete, additive proposal

### 1. A per-token `gloss` (MultiString) — the keystone
Add `gloss` to `SentenceToken`. A token already carries `form` + char-offsets + `entry_id`; adding an
aligned `gloss` turns it into a complete interlinear unit. Make it a **MultiString** so a token can
gloss in more than one analysis language at once (our sources gloss trilingually — en *and* zh); the
gloss line then renders per selected gloss language, for free. `entry_id` stays **independent of and
optional to** `gloss` — grammatical morphemes and portmanteaux ("3PL") often have no lexeme entry, yet
must still be glossable. Multi-word-to-one-gloss (e.g. two syllables → one gloss) is already
expressible as a single token spanning the char range — the offset model handles it; it just needs
the gloss slot.

```
SentenceToken {
  form: string; start: number; end: number
  gloss?: MultiString          // NEW — aligned interlinear gloss, per analysis language
  entry_id?; sense_id?         // existing lexical link (independent of gloss)
  candidates?; status?
}
```

### 2. Make `tokens` writable on sentence create/patch
`SentenceInput` currently omits `tokens` — they're auto-matched server-side. But for an imported
glossed corpus we already have the **gold** alignment + gloss from the source (the `rows`); we must be
able to POST the token list (form + offsets + gloss + entry_id) rather than hope an auto-matcher
reconstructs it against a specialized orthography (which can't invent glosses at all). Add `tokens` to
`SentenceInput`/`SentencePatch`; keep the auto-matcher as the fallback when tokens are omitted.

### 3. Optional morpheme sub-structure (do-it-right, for the wider user base)
Isolating languages (like ours) are mostly one-morpheme-per-word, but polysynthetic importers need
sub-word segmentation (affixes `-`, clitics `=`, reduplication `~`, one-morpheme-many-glosses `.`).
Support an optional `morphemes: [{ form, gloss: MultiString, entry_id? }]` inside a token. Optional and
ignorable for isolating data, but it's what makes the model *actually* Leipzig-complete and future-proof.

### 4. A dictionary-level glossing-abbreviations legend
IGT is unreadable without an abbreviations key (`3PL` → "third person plural", `PFV` → "perfective").
Add a small dictionary-scoped map (mirror `clause-slots`: `{ code, name: MultiString }`), seedable from
the standard Leipzig abbreviation set plus custom entries. Then any gloss abbreviation is tap-to-expand
and gloss lines become self-documenting.

### 5. Per-source citation locus on a sentence's source reference
`sentences.sources[]` is bare slugs. Our examples cite a *locus* (e.g. a page/example number, and often
a nested "as quoted from X 1981:31"). Let a source ref optionally be `{ slug, locator }` (plain slug
string still accepted) so scholarly provenance — page/example number — survives.

### 6. Example number label
Optional `label` on the sentence (or the section↔sentence ref) for the authors' own "(2a)" numbering —
cheap, and essential for cross-referencing within a grammar.

## Tiers you ALREADY handle (call out, so they're not re-invented)
- **IPA / phonemic tier** — just another orthography key in the `text` MultiString (add an `ipa`
  orthography). Already works.
- **Free translation, multiple languages** — `translation` MultiString. Already works.
- **Example reuse across text / sense / grammar** — by-reference model. Already there.

## The big vision (why this is best-in-class, not just adequate)
No mainstream platform ties an interlinear gloss token to a **live dictionary entry** AND to
**word-timed audio** at once. With `gloss` + `entry_id` on the token and `audio.timings` already
present, tapping a glossed word in a grammar example can, in one gesture: show its category gloss,
jump to its full dictionary entry, and **play that word inside the recorded sentence**. Layer on
`discourse_role` shading (foreground vs. background narrative) and the `clause-slot` template diagram,
and LD becomes a genuinely novel IGT + corpus surface — a magnet for the exact linguists who have
mountains of glossed data and nowhere good to put it. This is the highest-leverage place to think big.

## Minor / future
- Section `body` prose mentions lexemes inline (markdown italics) that won't be tappable — only the
  *referenced example sentences* are. Fine for v1; a future inline entry-link markdown syntax
  (`[[entry_id]]`) would make prose itself tappable.
- `discourse_role` is one value per sentence; a sentence with multiple clauses of differing salience
  would want clause-level tagging eventually. Sentence-level is a fine v1.

## Delivery
- Candid version = this file (Hmong/source specifics OK — it's for Jacob to hand to his own LD-dev
  agent).
- Generic version → `ld-import/send_feedback.py --kind other` (no project/personal/source names; the
  proven channel that reached the LD agent for chunks 1 & 2). Log the response below.
- **Status:** ✅ SENT 2026-07-14 via `send_feedback.py --kind other` (generic, 3732 chars — the
  endpoint caps at 4000). API returned `200 {"received":true}`. This file keeps the candid version.
