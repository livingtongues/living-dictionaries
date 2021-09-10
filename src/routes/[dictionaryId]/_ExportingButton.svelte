<script lang="ts">
  import { saveAs } from 'file-saver';
  import JSZip from 'jszip';
  import { _ } from 'svelte-i18n';

  export let images: string[];

  async function downloadHandler() {
    let blobImgs = [];
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
      zip.generateAsync({ type: 'blob' }).then((blob) => {
        saveAs(blob, 'myImage.zip');
      });
    }
  }
</script>

<button on:click|preventDefault={downloadHandler}>
  <i class="far fa-download" />
  <span class="font-medium mx-2">
    {$_('misc.export', { default: 'Export' })}
  </span>
</button>

<style>
  button {
    @apply text-gray-600 hover:bg-gray-200 px-3 py-2 flex items-center md:rounded-lg mb-2 w-full;
  }
</style>
