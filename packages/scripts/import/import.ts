import { program } from 'commander'

// import { importFromSpreadsheet } from './import-spreadsheet-v4.js';
import { importFromSpreadsheet } from './supabase-senses'

program
  //   .version('0.0.1')
  .option('-e, --environment [dev/prod]', 'Firebase Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .option('--dry', 'Only log values, do not upload data and media')
  .parse(process.argv)

const dictionaryId = program.opts().id
const { dry } = program.opts()
if (dry)
  console.log('Dry run, no data will be uploaded')

console.log(`Importing ${dictionaryId} to ${program.opts().environment}.`)
importFromSpreadsheet(dictionaryId, dry).then(entries => console.log(entries))
