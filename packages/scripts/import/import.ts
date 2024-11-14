import { readFileSync } from 'node:fs'
import { program } from 'commander'
import { parseCSVFrom } from './parse-csv.js'
import type { Row } from './row.type'
import { import_data } from './import-data.js'

program
  .option('-e, --environment [dev/prod]', 'Database Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'By default only values are logged, run with live flag to upload data and media')
  .parse(process.argv)

const { live, id: dictionary_id, environment } = program.opts()

await import_from_spreadsheet({ dictionary_id, live })

async function import_from_spreadsheet({ dictionary_id, live }: { dictionary_id: string, live: boolean }) {
  if (live)
    console.log('Live run, everything is happening!')
  else
    console.log('Dry run, no data will be uploaded')

  console.log(`Importing ${dictionary_id} to ${environment}.`)

  const dateStamp = Date.now()
  const import_id = `v4-${dateStamp}`

  const file = readFileSync(`./import/data/${dictionary_id}/${dictionary_id}.csv`, 'utf8')
  const rows = parseCSVFrom<Row>(file)
  rows.shift() // remove header row
  await import_data({ dictionary_id, rows, import_id, live })
  // todo: import media

  console.log(
    `Finished ${live ? 'importing' : 'emulating'} ${rows.length} entries to ${environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionary_id} in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
  console.log('') // line break
}
