import algoliasearch from 'algoliasearch';
import { projectId } from "../config";
import { adminKey } from './algolia-admin-key.json';
import { AlgoliaEntry } from '@living-dictionaries/types';

const ALGOLIA_APP_ID = 'XCVBAYSYXD';

export const client = algoliasearch(ALGOLIA_APP_ID, adminKey);

const index = client.initIndex(
  projectId === 'talking-dictionaries-dev' ? 'entries_dev' : 'entries_prod'
);

const CHUNK_SIZE = 2000
const TWENTY_SECONDS = 20 * 1000
const sleep = async (time: number) => await new Promise((resolve) => setTimeout(resolve, time));

export async function updateIndex(entries: AlgoliaEntry[]) {
  for (let startOfChunkIndex = 0; startOfChunkIndex < entries.length; startOfChunkIndex += CHUNK_SIZE) {
    const endOfChunk = startOfChunkIndex + CHUNK_SIZE
    const chunk = entries.slice(startOfChunkIndex, endOfChunk);
    console.log({ startOfChunkIndex, endOfChunk, CHUNK_SIZE, chunkLength: chunk.length });

    index
      .saveObjects(chunk)
      .then(({ objectIDs }) => {
        console.log(`Entries indexed: ${objectIDs.length}`);
      })
      .catch((err) => {
        console.log(err);
      });

    if (startOfChunkIndex + CHUNK_SIZE < entries.length) {
      console.log("Pausing to avoid hitting Algolia rate limit...");
      await sleep(TWENTY_SECONDS)
    }
  }

  // https://www.algolia.com/doc/api-reference/api-methods/add-objects/#examples
  // if forced to iterate instead of save all at once, take note of the rate limiting at 5000 backlogged requests https://www.algolia.com/doc/faq/indexing/is-there-a-rate-limit/
}
