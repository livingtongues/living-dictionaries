// Main
export { firebaseConfig } from './config';
export { firebaseApp, db } from './init';

// Interfaces
export type { IBaseUser, IFirestoreMetaData, IFirestoreMetaDataAbbreviated } from './interfaces';

// Firestore Helpers
export {
  getUid,
  colRef,
  docRef,
  getCollection,
  getDocument,
  add,
  set,
  update,
  deleteDocument,
  docExists,
} from './firestore';
export { addOnline, setOnline, updateOnline, deleteDocumentOnline } from './firestore-lite';

// Components
export { default as Collection } from './components/Collection.svelte';
export { default as Doc } from './components/Doc.svelte';
export { default as FirebaseUiAuth } from './components/FirebaseUiAuth.svelte';

// Stores & Auth
export { collectionStore, docStore } from './stores';
export { authState, createUserStore, logOut } from './user';
export { updateUserData } from './updateUserData';

// Helpers
export { loadScriptOnce, loadStylesOnce } from './loader';
