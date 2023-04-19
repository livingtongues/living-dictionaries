Before merge:
- Make sure all database saves (updateOnline, update, setOnline, set) use GoalDatabase___ interface
  - broken : EditAudio.svelte:52

Future todo: 
- handle case of multiple parts of speech - formatEntries.ts

Explain:
- make sure to run tests after making changes, parse-csv.ts had no scientificName in its test expectations.