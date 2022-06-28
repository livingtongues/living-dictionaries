# Guide to add a new entry fields if needed

These are the main steps to follow if you need to add a new entry field for any reason (however, adding of a new entry field must always be discussed among all group members before moving forward).

1. First you need to select an unused abbreviation for the new field and add it to `packages\types\entry.interface.ts`

2. Go to `packages\site\src\routes\[dictionaryId]\entry\_EntryDisplay.svelte` and select where you will need to add the new field on the UI, most likely it is an EntryField, if not, create a new one only if necessary (examples of that case are the EntrySemanticDomains and the EntryPartOfSpeech).

3. You'll also need to add the new field in the table view, in order to do that, go to `packages\site\src\lib\stores\columns.ts` and add a new object inside the `defaultColumns` array, the field should be exacly the same abbreviation you put in the entry interface.

4. Add the new field in the [translations spreadsheet](https://docs.google.com/spreadsheets/d/1SqtfUvYYAEQSFTaTPoAJq6k-wlbuAgWCkswE_kiUhLs/edit#gid=0). Again you need to add the same abbreviation in the item column.

5. Now you need to add the new field in two parts here: `packages\site\src\routes\[dictionaryId]\export\_formatEntries.ts`. First in the `headers` object and in the `itemsFormatted` array.

6. It's very likely you also want to consider to add the new field when import a dictionary from a spreadsheet. Go to `packages\scripts\import\import-spreadsheet-v4.ts` and add the necessary code.

7. Finally ask if there would be necessay to create a new filter(s) for this new field. In case this is require, go to `packages\scripts\algolia\prepareDataForIndex.ts` and add the pertinent filters.
