// Inspired by https://fireship.io/lessons/firestore-advanced-usage-angularfire/
import { get } from 'svelte/store';
import { user } from '$sveltefire/user';
import {
  getFirestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  CollectionReference,
  DocumentReference,
  QueryConstraint,
} from 'firebase/firestore/lite';
import type { IUser } from '$lib/interfaces';

export const getUid = () => {
  const u = get(user) as IUser;
  return (u && u.uid) || 'anonymous'; // useful if allowing support messages to be saved by non-logged-in users
};

type CollectionPredicate<T> = string | CollectionReference<T>;
type DocPredicate<T> = string | DocumentReference<T>;

export function colRef<T>(ref: CollectionPredicate<T>): CollectionReference<T> {
  const db = getFirestore();
  return typeof ref === 'string' ? (collection(db, ref) as CollectionReference<T>) : ref;
}

export function docRef<T>(ref: DocPredicate<T>): DocumentReference<T> {
  if (typeof ref === 'string') {
    const pathParts = ref.split('/');
    const documentId = pathParts.pop();
    const collectionString = pathParts.join('/');
    return doc<T>(colRef(collectionString), documentId);
  } else {
    return ref;
  }
}

export async function getDocument<T>(ref: DocPredicate<T>): Promise<T> {
  const docSnap = await getDoc(docRef(ref));
  return docSnap.exists() ? { ...(docSnap.data() as T), id: docSnap.id } : null;
}

export async function getCollection<T>(
  path: CollectionPredicate<T>,
  queryConstraints: QueryConstraint[] = []
): Promise<T[]> {
  const ref = typeof path === 'string' ? colRef<T>(path) : path;
  const q = query(ref, ...queryConstraints);
  const collectionSnap = await getDocs(q);
  return collectionSnap.docs.map((docSnap) => ({
    ...docSnap.data(),
    id: docSnap.id,
  }));
}

export function add<T>(
  ref: CollectionPredicate<T>,
  data: T,
  abbreviateMetadata = false
): Promise<DocumentReference<T>> {
  // @ts-ignore
  return addDoc(colRef(ref), {
    ...data,
    [abbreviateMetadata ? 'ua' : 'updatedAt']: serverTimestamp(),
    [abbreviateMetadata ? 'ca' : 'createdAt']: serverTimestamp(),
    [abbreviateMetadata ? 'ub' : 'updatedBy']: getUid(),
    [abbreviateMetadata ? 'cb' : 'createdBy']: getUid(),
  });
}

export async function set<T>(
  ref: DocPredicate<T>,
  data: T,
  abbreviateMetadata = false,
  merge = false
): Promise<void> {
  const snap = await getDocument(ref);
  return await (snap
    ? update(ref, data)
    : setDoc(
        docRef(ref),
        // @ts-ignore
        {
          ...data,
          [abbreviateMetadata ? 'ua' : 'updatedAt']: serverTimestamp(),
          [abbreviateMetadata ? 'ca' : 'createdAt']: serverTimestamp(),
          [abbreviateMetadata ? 'ub' : 'updatedBy']: getUid(),
          [abbreviateMetadata ? 'cb' : 'createdBy']: getUid(),
        },
        { merge }
      ));
} // could split apart into set and upsert if desired, https://stackoverflow.com/questions/46597327/difference-between-set-with-merge-true-and-update

export function update<T>(
  ref: DocPredicate<T>,
  data: Partial<T>,
  abbreviateMetadata = false
): Promise<void> {
  // @ts-ignore
  return updateDoc(docRef(ref), {
    ...data,
    [abbreviateMetadata ? 'ua' : 'updatedAt']: serverTimestamp(),
    [abbreviateMetadata ? 'ub' : 'updatedBy']: getUid(),
  }).catch((err) => {
    alert(err);
  });
}

export function deleteDocument<T>(ref: DocPredicate<T>): Promise<void> {
  return deleteDoc(docRef(ref));
}

export async function docExists<T>(ref: DocPredicate<T>): Promise<boolean> {
  return (await getDoc(docRef(ref))).exists();
}
