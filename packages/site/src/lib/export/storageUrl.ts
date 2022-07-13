import { firebaseConfig } from '$lib/firebaseConfig';

export function getStorageDownloadUrl(path: string) {
  const convertedPath = path.replace(/\//g, '%2F');
  return `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media`;
}
