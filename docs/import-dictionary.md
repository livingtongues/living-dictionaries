# Import Dictionary from Google Sheets template v4

- Download Kalinago CSV from online and replace empty kalinago.csv file.
- `cd functions`
- `npm i` if not done yet
- `npm run importDictionary -- --id kalinago` (will import to dev environment by default)
- Check the outputted log file (functions/scripts/logs/...) and the dictionary on localhost (or deployed dev url) to make sure all is good
- If all looks good `npm run importDictionary -- --id kalinago -e prod` to push the data live
- Tell Anna to look at it and make it public if all is good.
