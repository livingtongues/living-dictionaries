import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID } from './config';
import algoliaKeys from './algolia-admin-key.json';
const ADMIN_KEY = algoliaKeys.adminKey;
const client = algoliasearch(ALGOLIA_APP_ID, ADMIN_KEY);

client.copyIndex('entries_prod', 'entries_dev').then(() => {
  console.log('entry records copied');
});

// const client = algoliasearch(ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
// "copy-algolia-prod-records-to-dev": "cross-env ALGOLIA_ADMIN_KEY=_________ node scripts/algolia/copyAlgoliaIndexRecords.js"

// https://www.algolia.com/doc/api-reference/api-methods/copy-index/?client=javascript#examples
