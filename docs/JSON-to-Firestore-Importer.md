# JSON to Firestore Importer (OUTDATED)

Built with help from https://angularfirebase.com/lessons/import-csv-json-or-excel-to-firestore/

## Initial setup

1. Run `npm install`
2. Compile Typescript into Javscript (see below)
3. Import needed service account json files into /service-accounts
4. Place JSON data, audio files, and photos into appropriate folders (/d-data, /d-audio, /d-photos)

### To Compile Typescript files into Javascript after making changes

Run `tsc` (must have installed Typescript beforehand)
or press `Ctrl+Shift+B` and select `tsc: watch - tsconfig.json` to start the Typescript watcher

## How to Import data+audio/photos to Firestore

1. Write proper gloss fields into importToFirestore.ts (\*at least until a cross-dictionary pattern can be established)
2. Run `firestore-import --data <data.json> --audio <folder> --photos <folder> --dictionaryId <dictionaryId> --dictionaryName <dictionaryName> --environment prod`
   The script defaults to dev environment if prod not mentioned as environment is an optional argument. See https://github.com/tj/commander.js/ for help with required and optional arguments.

As an example using abbreviated argument names, to import Chamococo to the dev site, run `firestore-import -d d-data/chamacoco_export.json -a d-audio -p d-photos -i yRl8SvrwmeyckpCHU1X5 -n Chamococo`

Or `firestore-import -d d-data/photo_test.json -a d-audio -p d-photos -i kRlFo5AymRG2hYWg4mpY -n Spanish`

### How to run the script to gather parts of speech

Run `npm run gather-pos -s <source>`, for example: `gather-pos -s data/chamacoco_export.json`

`npm run import-old-td dryRun`

Debug .ts file w/o compiling: https://medium.com/@dupski/debug-typescript-in-vs-code-without-compiling-using-ts-node-9d1f4f9a94a
