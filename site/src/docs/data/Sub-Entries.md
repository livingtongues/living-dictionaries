# Related Entries

You can be on an entry and create a related-entry. When someone creates a related-entry, we first ask them the type of related entry. The type determines what entry fields they allowed to edit. For example, to edit the audio for a homonym, you must go and edit the parent entry. To edit the image for a dialectal variant, they need to go and edit the parent entry.

## Types of Related Entries (type may restrict editing options)

- Lexical variant: conjugations/varying-forms based on tense/gender-marking/case-marking/etc (**Headwords** are **parents**, other forms are **children**, unless no headword system then all conjugations are **sibling**)

- homonyms (**sibling entries** - do we connect IPA and audio recordings?)
- dialectal variations (needs separate pronunciation, but not separate glossing, semantic domain, image...)

- example sentences (children entries)

- spelling variations (NOT a related entry, it's just another entry field we can add)

## Data Model

Entries with reference markers indicating parent/child/sibling relationships

- Entry A: lx: "dog", type: "head", children: [C]
- Entry B: lx: "park", type: "head", children: [C]
- Entry C: lx: "a dog runs in the park", type: "example sentence", parents: [A, B]

When Entry A is opened, load Entry A and then loop over entry.children as subentry and fetch each entry

## Use cases

A user searches for dog and they probably want just the entry, but they also might be even more interested in an example sentence. They coud click either

- if they click "dog" they go to that entry which will also show related entries at the bottom like an example sentence
- if they click "A dog runs in the park" they will get the example sentence entry but it will also show it's parent entry of "dog"

## Data models not being used because it restricts related-entries:

1. Sub-entries nested in same document
   ```js
   const entryA = {
      id: A
      lx: 'dog'
      subEntries: [
         {
            lx: 'dog' "dog-tired"
         }
      ]
   }
   ```
2. Sub-collections
   Entry A: "dog"

- related-collection of entries (fetched by `entries/id/related-entries`)
  - Entry example: "A dog runs in the park"

Entry B: "park"

- related-collection of entries
  - Entry example: "A dog runs in the park"
