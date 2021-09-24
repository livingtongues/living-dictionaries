<script lang="ts">
  import { dictionary } from '$lib/stores';
  import type { IDictionary } from '$lib/interfaces';
  import { orderBy } from '@firebase/firestore';
  import { where } from 'firebase/firestore';
  import Button from '$svelteui/ui/Button.svelte';
  import JSZip from 'jszip';
  import { getDocument } from '$sveltefire/firestore';

  export let images: string[];
  let dataDictionary: IDictionary;

  async function download() {
    dataDictionary = await getDocument<IDictionary>(`dictionaries/${$dictionary.id}`);
    console.log(dataDictionary);
    //Zip and downloading images
    /* let blobImgs = [];
    await Promise.all(
      images.map(async (url) => {
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
      let zip = new JSZip();
      let photos = zip.folder('home/photos');
      let i = 1;
      blobImgs.forEach((bi) => {
        photos.file(`image${i}.jpeg`, bi, { binary: true });
        i++;
      });
      const { saveAs } = await import('file-saver');
      zip.generateAsync({ type: 'blob' }).then((blob) => {
        saveAs(blob, 'myImage.zip');
      });
    } */
  }
</script>

<Button onclick={download} form="primary">ZIP Export</Button>
