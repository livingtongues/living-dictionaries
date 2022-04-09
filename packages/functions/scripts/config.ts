import { program } from 'commander';
import admin from 'firebase-admin';

program
  //   .version('0.0.1')
  .option('-e, --environment [dev/prod]', 'Firebase Project', 'dev')
  .parse(process.argv);

export const environment = program.opts().environment === 'prod' ? 'prod' : 'dev';
export const projectId =
  environment === 'prod' ? 'talking-dictionaries-alpha' : 'talking-dictionaries-dev';

import serviceAccountDev from '../service-account-dev.json';
import serviceAccountProd from '../service-account-prod.json';
const serviceAccount = environment === 'dev' ? serviceAccountDev : serviceAccountProd;

admin.initializeApp({
  //@ts-ignore - for some reason, the object is correct but not typed properly
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${projectId}.firebaseio.com`,
  storageBucket: `${projectId}.appspot.com`,
});
export const db = admin.firestore();
// const settings = { timestampsInSnapshots: true };
// db.settings(settings);
export const firebase = admin;
export const timestamp = admin.firestore.FieldValue.serverTimestamp();
export const storage = admin.storage();

///LOGGER///
import fs from 'fs';
const logFile = fs.createWriteStream(`./scripts/logs/${Date.now()}.txt`, { flags: 'w' }); // 'a' to append, 'w' to truncate the file every time the process starts.
console.log = function (data: any) {
  logFile.write(JSON.stringify(data) + '\n');
  process.stdout.write(JSON.stringify(data) + '\n');
};
///END-LOGGER///

console.log(`Running on ${environment}`);
