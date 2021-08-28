import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID } from './config';
import algoliaKeys from './algolia-admin-key.json';
const ADMIN_KEY = algoliaKeys.adminKey;
const client = algoliasearch(ALGOLIA_APP_ID, ADMIN_KEY);

client.copySettings('entries_dev', 'entries_prod').then(() => {
  console.log('settings copied');
});
