import { client } from "./algolia";

client.copyIndex('entries_prod', 'entries_dev').then(() => {
  console.log('entry records copied');
});

// const client = algoliasearch(ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
// "copy-algolia-prod-records-to-dev": "cross-env ALGOLIA_ADMIN_KEY=_________ node scripts/algolia/copyAlgoliaIndexRecords.js"

// https://www.algolia.com/doc/api-reference/api-methods/copy-index/?client=javascript#examples
