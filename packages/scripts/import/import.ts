import { readFileSync } from 'node:fs'
import { program } from 'commander'
import { parseCSVFrom } from './parse-csv.js'
import type { Row } from './row.type'
import { import_data } from './import-data.js'
import { upload_audio_to_gcs, upload_photo_to_gcs } from './import-media.js'

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
  if (rows[0].lexeme.includes('word/phrase')) rows.shift() // remove header row
  await import_data({ dictionary_id, rows, import_id, live, upload_operations: { upload_audio, upload_photo } })

  console.log(
    `Finished ${live ? 'importing' : 'emulating'} ${rows.length} entries to ${environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionary_id} in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
  console.log('') // line break
}

async function upload_photo(filepath: string, entry_id: string) {
  return await upload_photo_to_gcs({ dictionary_id, filepath, entry_id, live })
}

async function upload_audio(filepath: string, entry_id: string) {
  return await upload_audio_to_gcs({ dictionary_id, filepath, entry_id, live })
}
