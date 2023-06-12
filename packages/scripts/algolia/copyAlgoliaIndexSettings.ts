import { client } from './algolia';

client.copySettings('entries_dev', 'entries_prod').then(() => {
  console.log('settings copied');
});
