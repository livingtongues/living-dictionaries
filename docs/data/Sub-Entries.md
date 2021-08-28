# Sub Entries

You can be on an entry and create a sub-entry. When someone creates a sub-entry, we first ask them the type of sub entry. The type determines what entry fields they allowed to edit. For example, to edit the audio for a homonym, you must go and edit the parent entry. To edit the image for a dialectal variant, they need to go and edit the parent entry.

## Types of Sub Entries (type may restrict editing options)

- conjugations/varying-forms based on tense/case-marking/etc (will let media be edited, but maybe not needed?)
- homonyms (needs separate glossing, semantic domain, image... but doesn't need separate pronunication)
- dialectal variations (needs separate pronunciation, but not separate glossing, semantic domain, image...)

- example sentences (full-blown entry, needs everything)

- ? spelling variations (should this just be another entry field and not be a type of sub-entry)

## Data Model

Sibling entries with reference markers indicating parent/child relationships

- Entry A: lx: "dog", type: "head", children: [C]
- Entry B: lx: "park", type: "head", children: [C]
- Entry C: lx: "a dog runs in the park", type: "example sentence", parents: [A, B]

When Entry A is opened, load Entry A and then loop over entry.children as subentry and fetch each entry

## Use cases

A user searches for dog and they probably want just the entry, but they also might be even more interested in an example sentence. They coud click either

- if they click "dog" they go to that entry which will also show related entries at the bottom like an example sentence
- if they click "A dog runs in the park" they will get the example sentence entry but it will also show it's parent entry of "dog"

## Data models not being used because it restricts sub-entries:

1. Sub-entries nested in same document
   Entry A = {
   id: A
   lx: 'dog'
   subEntries: [
   {
   lx: 'dog'
   "dog-tired"
   }
   ]
   }

2. Sub-collections
   Entry A: "dog"

- sub-collection of entries (fetched by entries/${id}/sub-entries)
  - Entry example: "A dog runs in the park"

Entry B: "park"

- sub-collection of entries
  - Entry example: "A dog runs in the park"
