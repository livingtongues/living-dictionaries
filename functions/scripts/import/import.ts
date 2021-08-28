import { program } from 'commander';

program
  //   .version('0.0.1')
  .option('-e, --environment [dev/prod]', 'Firebase Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .parse(process.argv);

import { importFromSpreadsheet } from './import-spreadsheet-v4';

const dictionaryId = program.opts().id;
importFromSpreadsheet(dictionaryId).then((entries) => console.log(entries));
