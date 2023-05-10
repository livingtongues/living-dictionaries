import algoliasearch from 'algoliasearch';
import { projectId } from "../config";
import { adminKey } from './algolia-admin-key.json';
import { AlgoliaEntry } from '@living-dictionaries/types';

const ALGOLIA_APP_ID = 'XCVBAYSYXD';

export const client = algoliasearch(ALGOLIA_APP_ID, adminKey);

const index = client.initIndex(
  projectId === 'talking-dictionaries-dev' ? 'entries_dev' : 'entries_prod'
);

const MAX_CHUNK_SIZE = 3000
// https://www.algolia.com/doc/api-reference/api-methods/add-objects/#examples
// if forced to iterate instead of save all at once, take note of the rate limiting at 5000 backlogged requests https://www.algolia.com/doc/faq/indexing/is-there-a-rate-limit/

export async function updateIndex(entries: AlgoliaEntry[]) {
  try {
    for (let startOfChunkIndex = 0; startOfChunkIndex < entries.length; startOfChunkIndex += MAX_CHUNK_SIZE) {
      const endOfChunk = startOfChunkIndex + MAX_CHUNK_SIZE
      const chunk = entries.slice(startOfChunkIndex, endOfChunk);
      console.log({ startOfChunkIndex, endOfChunk, CHUNK_SIZE: MAX_CHUNK_SIZE, chunkLength: chunk.length });

      const { objectIDs } = await index.saveObjects(chunk);
      console.log(`Entries indexed: ${objectIDs.length}`);
    }
  } catch (err) {
    console.log(err);
  }

}
