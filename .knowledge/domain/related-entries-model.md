# Related-entries model (design rationale)

Why related entries are modeled as **flat entries with parent/child/sibling references**, not as
sub-entries nested inside one document. This is the *reasoning* behind the schema — the schema
itself is in `site/src/lib/db/schemas/`.

## The shapes considered (and why the flat model won)
1. **Nested sub-entries** (`entryA.subEntries = [...]`) — rejected: a sub-entry can't be shared by
   two parents, can't be searched/linked as a first-class entry, and can't have its own media.
2. **Sub-collections** (`entries/{id}/related-entries`) — rejected for the same first-class reasons.
3. **Flat entries + relationship references** — chosen. Every related thing is a normal entry; the
   relationship is a reference, so an entry can have multiple parents and be reached from any of them.

Example (one example sentence shared by two headwords):
- Entry A: `lx: "dog"`, type `head`, children `[C]`
- Entry B: `lx: "park"`, type `head`, children `[C]`
- Entry C: `lx: "a dog runs in the park"`, type `example sentence`, parents `[A, B]`

When A opens, load A then fetch each `entry.children`. From C you can navigate up to either parent.

## The relationship *type* gates what's editable
The type of a related entry restricts which fields you edit where (so shared data isn't duplicated
or contradicted):
- **Lexical variant** — conjugations / inflected forms (tense, gender, case). With a headword
  system the headword is the **parent** and the forms are **children**; with no headword system the
  forms are **siblings**.
- **Homonym** — **sibling** entries (open question kept from the original notes: whether to share
  IPA + audio between homonyms).
- **Dialectal variation** — needs its own pronunciation/audio but shares glossing, semantic domain,
  and image with the parent → edit those on the parent.
- **Example sentence** — **child** entries (can have multiple parents, as above).
- **Spelling variation** — *not* a related entry; it's just another field on the same entry.

## UX intent
Search surfaces both the headword and its related entries. Clicking "dog" lands on the entry with
its related entries (e.g. an example sentence) shown at the bottom; clicking the example sentence
lands on that entry with its parent headword(s) shown. Either path reaches the whole cluster.
