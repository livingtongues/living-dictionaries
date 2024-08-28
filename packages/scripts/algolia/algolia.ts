import algoliasearch from 'algoliasearch'
import type { AlgoliaEntry } from '@living-dictionaries/types'
import { projectId } from '../config-firebase'
import { adminKey } from './algolia-admin-key.json'

const ALGOLIA_APP_ID = 'XCVBAYSYXD'

export const client = algoliasearch(ALGOLIA_APP_ID, adminKey)

const index = client.initIndex(
  projectId === 'talking-dictionaries-dev' ? 'entries_dev' : 'entries_prod',
)

const MAX_CHUNK_SIZE = 3000
// https://www.algolia.com/doc/api-reference/api-methods/add-objects/#examples
// if forced to iterate instead of save all at once, take note of the rate limiting at 5000 backlogged requests https://www.algolia.com/doc/faq/indexing/is-there-a-rate-limit/

export async function updateIndex(entries: AlgoliaEntry[]) {
  try {
    for (let startOfChunkIndex = 0; startOfChunkIndex < entries.length; startOfChunkIndex += MAX_CHUNK_SIZE) {
      const endOfChunk = startOfChunkIndex + MAX_CHUNK_SIZE
      const chunk = entries.slice(startOfChunkIndex, endOfChunk)
      console.log({ startOfChunkIndex, endOfChunk, CHUNK_SIZE: MAX_CHUNK_SIZE, chunkLength: chunk.length })

      const { objectIDs } = await index.saveObjects(chunk)
      console.log(`Entries indexed: ${objectIDs.length}`)
      // await new Promise(resolve => setTimeout(resolve, 10000)) // extra caution to avoid rate limiting when doing large batches
    }
  } catch (err) {
    console.log(err)
  }
}
