# Apps-script code for IDS Project

## Description
This script automates data import from the previously exported IDS tsv files to our batch import sheets.

## How to edit
1. Create a `.env.local` file based on the `.env.local.example` and paste the ID of the Google spreadheet that you are interested to work on. also paste the absolute path of you root directory which is the path that contains the `appsscript.json` and the `.clasp.json`.
2. type `cd packages/ids-import`
3. If it's the first time, type `npx clasp login` to grant permission to handle the spreadsheet you want.
4. Finally type `npm run clasp:push` to start editing the code. Each time you save any file it will automatically push all the changes to the Apps-script code of your spreadsheet.
5. Just stop the process when you have finished.