# Guide to add new entry fields

These are the main steps to follow if you need to add a new entry field:

1. Discuss addition of new entry field with team

2. Create abbreviated field name and add to `packages/types/entry.interface.ts` (consult *Making Dictionaries - A Guide to Lexicography and the Multi-Dictionary Formatter - Coward Grimes 2000, Appendix A: Alphabetized listing of field markers* for a good option - Jacob has a copy)

3. Go to `packages/site/src/routes/[dictionaryId]/entry/_EntryDisplay.svelte` and select where you will need to add the new field on the UI, most likely it is an EntryField, if not, create a new one only if necessary (examples of that case are the EntrySemanticDomains and the EntryPartOfSpeech).

4. Add the new field in the table view: in `packages/site/src/lib/stores/columns.ts` add a new object inside the `defaultColumns` array, the field should be the same as you put in the entry interface.

5. Add the new field in the [translations spreadsheet](https://docs.google.com/spreadsheets/d/1SqtfUvYYAEQSFTaTPoAJq6k-wlbuAgWCkswE_kiUhLs/edit#gid=0) using the same abbreviated field name Again you need to add the same abbreviation in the **item** column.

6. Add the new field in `packages/site/src/routes/[dictionaryId]/export/_formatEntries.ts` in the `headers` object and in the `itemsFormatted` array.

7. Consider whether the new field needs added to the dictionary import spreadsheet template. If so add to the latest spreadsheet template. Then update the example import csv (`packages/scripts/import/data/example/example.csv`) then in `packages/scripts` run `pnpm test` to run tests while you add the needed code in `packages/scripts/import/convertJsonRowToEntryFormat.ts` to import the new field. You are finished when the test results include the new field and nothing is broken. 

8. Ask if a new filter is needed for this new field. If so, add to `packages/scripts/algolia/prepareDataForIndex.ts` and deploy the updated cloud functions that use that function (add, update, and delete).
