import fs from 'node:fs'
import { program } from 'commander'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
// import serviceAccountDev from './service-account-dev.json';
// import serviceAccountProd from './service-account-prod.json';
import { serviceAccountDev, serviceAccountProd } from './service-accounts'

/// LOGGER///

program
  //   .version('0.0.1')
  .option('-e, --environment [dev/prod]', 'Firebase Project', 'dev')
  .allowUnknownOption() // because config is shared by multiple scripts
  .parse(process.argv)

export const environment = program.opts().environment === 'prod' ? 'prod' : 'dev'
export const projectId
  = environment === 'prod' ? 'talking-dictionaries-alpha' : 'talking-dictionaries-dev'

const serviceAccount = environment === 'dev' ? serviceAccountDev : serviceAccountProd

initializeApp({
  // @ts-expect-error
  credential: cert(serviceAccount),
  databaseURL: `https://${projectId}.firebaseio.com`,
  storageBucket: `${projectId}.appspot.com`,
})
export const db = getFirestore()
// const settings = { timestampsInSnapshots: true };
// db.settings(settings);
export const timestamp = FieldValue.serverTimestamp()
export const storage = getStorage()
export const auth = getAuth()
const logFile = fs.createWriteStream(`./logs/${Date.now()}.txt`, { flags: 'w' }) // 'a' to append, 'w' to truncate the file every time the process starts.
console.log = function (data: any) {
  logFile.write(`${JSON.stringify(data)}\n`)
  process.stdout.write(`${JSON.stringify(data)}\n`)
}
/// END-LOGGER///

console.log(`Running on ${environment}`)
