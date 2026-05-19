# Support multiple example sentences per entry

Currently each sense has a single `IExampleSentence` object (a map of BCP language codes to strings). Users need the ability to add multiple example sentences per sense to better illustrate usage.

## Current state
- `IExampleSentence` is `{ [bcp: string]: string }` — one sentence translated into multiple glossing languages
- Used in `EditField.svelte`, `ListEntry.svelte`, `PrintEntry.svelte`, table `Cell.svelte`, import scripts, and `exampleSentences.ts` helper
- The print/display helpers iterate over a single `IExampleSentence` object

## Plan
- Change the data model so a sense can hold an array of example sentences instead of a single one (e.g. `example_sentences: IExampleSentence[]`)
- Migrate existing single example sentence data into the new array format
- Update UI components to display/edit multiple sentences (add/remove buttons)
- Update import/export to handle multiple sentences (e.g. numbered columns like `example_sentence_1.en`, `example_sentence_2.en`)
- Update print view and list view to render all sentences

## Research needed
- Decide whether to keep the existing `IExampleSentence` shape (BCP-keyed translations per sentence) or restructure
- Check how this interacts with senses if/when senses are implemented as a separate table in PGlite
