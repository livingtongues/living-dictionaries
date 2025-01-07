import { program } from 'commander'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
import { firebase_dev_service_account, firebase_prod_service_account } from './service-accounts'
import './record-logs'

program
  .option('-e, --environment [dev/prod]', 'Firebase/Supabase Project', 'dev')
  .allowUnknownOption() // because config is shared by multiple scripts
  .parse(process.argv)

export const environment = program.opts().environment === 'prod' ? 'prod' : 'dev'
console.log(`Firebase running on ${environment}`)

const serviceAccount = environment === 'dev' ? firebase_dev_service_account : firebase_prod_service_account
export const projectId = serviceAccount.project_id

initializeApp({
  // @ts-expect-error
  credential: cert(serviceAccount),
  databaseURL: `https://${projectId}.firebaseio.com`,
  storageBucket: `${projectId}.appspot.com`,
})
export const db = getFirestore()
export const timestamp = FieldValue.serverTimestamp()
export const storage = getStorage()
export const auth = getAuth()
