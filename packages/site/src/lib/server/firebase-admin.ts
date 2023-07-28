import { type ServiceAccount, cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { Firestore, getFirestore } from 'firebase-admin/firestore'
import { FIREBASE_SERVICE_ACCOUNT_CREDENTIALS } from "$env/static/private"

const SERVICE_ACCOUNT: ServiceAccount & { project_id?: string } = JSON.parse(FIREBASE_SERVICE_ACCOUNT_CREDENTIALS) // Firebase Admin typings use camelCase but Google Cloud Service Account credentials use snake_case oddly enough

let firebaseAdminApp: App = null;
let db: Firestore = null;

export function getFirebaseAdminApp(): App {
  if (firebaseAdminApp)
    return firebaseAdminApp;

  const currentApps = getApps();
  if (currentApps.length) {
    firebaseAdminApp = currentApps[0];
    return firebaseAdminApp;
  }

  firebaseAdminApp = initializeApp({
    credential: cert(SERVICE_ACCOUNT),
    databaseURL: `https://${SERVICE_ACCOUNT.project_id}.firebaseio.com`,
  })

  console.log('Firebase Admin initialized on server');

  return firebaseAdminApp;
}

export function getDb(): Firestore {
  if (db) {
    return db;
  }

  db = getFirestore(getFirebaseAdminApp());
  return db;
}

export async function decodeToken(token: string) {
  if (!token)
    throw new Error('Firebase user token missing.')

  try {
    return await getAuth(getFirebaseAdminApp()).verifyIdToken(token)
  }
  catch (err) {
    console.error(err)
    throw new Error(`Trouble initializing Firebase and verifying token: ${err}`)
  }
}


// see https://github.com/ManuelDeLeon/sveltekit-firebase-ssr for other possible backend firebase-admin use-cases
