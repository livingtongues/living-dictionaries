import { program } from 'commander';

program
  //   .version('0.0.1')
  .option('-e, --environment [dev/prod]', 'Firebase Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .option('--dry', 'Only log values, do not upload data and media')
  .parse(process.argv);

import { importFromSpreadsheet } from './import-spreadsheet-v4.js';

const dictionaryId = program.opts().id;
const dry = program.opts().dry;
if (dry) {
  console.log('Dry run, no data will be uploaded');
}
console.log(`Importing ${dictionaryId} to ${program.opts().environment}.`);
importFromSpreadsheet(dictionaryId, dry).then((entries) => console.log(entries));
