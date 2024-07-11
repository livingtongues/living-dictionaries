import { program } from 'commander'
// @ts-expect-error
import detect from 'detect-port'
import { importFromSpreadsheet } from './import-to-firebase-supabase'

await checkForDevServer()

async function checkForDevServer() {
  const port = await detect(3041) // will return 3041 if available, next available if it's not (so if 3041 is taken, it will return 3042, etc.)
  const devServerRunning = port > 3041
  if (devServerRunning) return
  throw new Error('SvelteKit dev server not detected - run `pnpm dev` before running this import script to ensure the endpoint functions that save to Supabase are available.')
}

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
