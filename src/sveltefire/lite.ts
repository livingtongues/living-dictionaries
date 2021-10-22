import { getFirestore, setDoc, getDoc, doc } from '@firebase/firestore/lite';

export async function setOnline<T>(ref: string, data: T): Promise<void> {
  const firestore = getFirestore();
  const docRef = doc(firestore, ref);
  return await setDoc(docRef, data);
}

export async function docExists(ref: string): Promise<boolean> {
  const firestore = getFirestore();
  const docRef = doc(firestore, ref);
  return (await getDoc(docRef)).exists();
}
