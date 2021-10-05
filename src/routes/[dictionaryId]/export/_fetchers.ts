import JSZip from 'jszip';
import type { IEntry } from '$lib/interfaces';
import { getCollection } from '$sveltefire/firestore';
import { exportEntriesAsCSV } from '$lib/export/csv';

export async function getImages(imageUrls: string[]) {
  //Zip and downloading images
  const blobImgs = [];
  await Promise.all(
    imageUrls.map(async (url) => {
      try {
        const fetchedImages = await fetch(url);
        const blobs = await fetchedImages.blob();
        blobImgs.push(blobs);
      } catch {
        //TODO I don't know what to do here!
        console.log('Something is wrong!');
      }
    })
  );
  if (blobImgs.length > 0) {
    const zip = new JSZip();
    const photos = zip.folder('home/photos');
    let i = 1;
    blobImgs.forEach((bi) => {
      photos.file(`image${i}.jpeg`, bi, { binary: true });
      i++;
    });
    const { saveAs } = await import('file-saver');
    zip.generateAsync({ type: 'blob' }).then((blob) => {
      saveAs(blob, 'myImage.zip');
    });
  }
}

export async function downloadEntries(id: string, name: string) {
  const dataEntries = await getCollection<IEntry>(`dictionaries/${id}/words`);
  exportEntriesAsCSV(dataEntries, name);
}
