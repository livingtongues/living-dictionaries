import type { FirebaseOptions } from 'firebase/app';

export let firebaseConfig: FirebaseOptions = {};

const envFirebaseConfigValue = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) as FirebaseOptions;
if (envFirebaseConfigValue.projectId) {
  firebaseConfig = envFirebaseConfigValue;
} else {
  throw Error('VITE_FIREBASE_CONFIG is not set.');
}

export const dev = import.meta.env.VITE_project !== 'talking-dictionaries-alpha';
