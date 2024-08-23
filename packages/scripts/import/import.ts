import { program } from 'commander'
// @ts-expect-error
import detect from 'detect-port'
import { importFromSpreadsheet } from './import-to-firebase-supabase'

await checkForDevServer()

async function checkForDevServer() {
  const port = await detect(3041) // will return 3041 if available, next available if it's not (so if 3041 is taken, it will return 3042, etc.)
  const devServerRunning = port > 3041
  if (devServerRunning) return
  throw new Error('SvelteKit dev server not detected - run `pnpm dev` (or `pnpm -F site prod` if deploying to production) before running this import script to ensure the endpoint functions that save to Supabase are available.')
}

program
  .option('-e, --environment [dev/prod]', 'Database Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'By default only values are logged, run with live flag to upload data and media')
  .parse(process.argv)

const dictionaryId = program.opts().id
const { live } = program.opts()
if (live)
  console.log('Live run, everything is happening!')
else
  console.log('Dry run, no data will be uploaded')

console.log(`Importing ${dictionaryId} to ${program.opts().environment}.`)
importFromSpreadsheet({ dictionaryId, live }).then(entries => console.log(entries))
