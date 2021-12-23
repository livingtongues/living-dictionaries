# How to import a Dictionary from our Google Sheets template v4

- Create a new folder in `functions/scripts/import/data` right next to the `example` folder and name it using the dictionary ID of your intended upload. We'll use `kalinago` as an demo in these instructions. Do note that the `example` folder will stay checked in to git but your data won't be because we don't want it in our repo.
- Download the CSV from Google Sheets online and place it into your newly created folder. Name it using the dictionary ID, `kalinago.csv` for example.
- If you have media, please include any images and audio files that are referenced from the csv file into `images` and `audio` subfolders.
- `cd functions` and `npm i` if needed
- Start by running `npm run importDictionary -- --id kalinago --dry` but use your appropriate dictionary id instead. This will emulate (dry run) an import to dev environment to let you inspect the log and see if there are any missing files
- Check the console log or the outputted log file found in `functions/scripts/logs` - it will be the newest one as they are saved by datestamp.
- Rerun your script with the `--dry` option: `npm run importDictionary -- --id kalinago` and inspect the dev-imported dictionary on localhost (or any deployed dev url) to make sure all is good - Note that because we don't have Algolia indexing the dev database currently, I added some code that let's dev show the 10 most recent entries from Firestore, but that's all you'll get for now until we make further changes - and only 10 from the last 60 minutes (see `Hits.svelte`). 
- If all looks good then run `npm run importDictionary -- --id kalinago --environment prod` to push the data live
- Look through the imported dictionary and then tell Anna to look at it and make it public if everyone is happy with it.

## Log inspection tip
- copy the outputted array of entries at the bottom of the log and paste into an empty .json file. Let VS Code auto-format it and then you can quickly comb through the data to make sure it looks good.