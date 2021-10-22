import {
  getFirestore,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  collection,
  serverTimestamp,
} from '@firebase/firestore/lite';
import type { DocumentReference, DocumentData } from 'firebase/firestore/lite';
import { getUid } from './firestore';

export async function setOnline<T>(ref: string, data: T): Promise<void> {
  const firestore = getFirestore();
  const docRef = doc(firestore, ref);
  return await setDoc(docRef, data);
}

export async function updateOnline<T>(ref: string, data: T): Promise<void> {
  const firestore = getFirestore();
  const docRef = doc(firestore, ref);
  return await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: getUid(),
  });
}

export async function addOnline<T>(ref: string, data: T): Promise<DocumentReference<DocumentData>> {
  const firestore = getFirestore();
  const collectionRef = collection(firestore, ref);
  return await addDoc(collectionRef, data);
}

export async function docExists(ref: string): Promise<boolean> {
  const firestore = getFirestore();
  const docRef = doc(firestore, ref);
  return (await getDoc(docRef)).exists();
}
