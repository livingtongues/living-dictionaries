<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry, IPhoto } from '$lib/interfaces';
  export let file: File, entry: IEntry;
  import { dictionary } from '$lib/stores';

  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  let progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);

  let error;
  let success: boolean;
  let previewURL: string;

  if (file && entry) {
    previewURL = URL.createObjectURL(file);
    startUpload();
  }

  import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

  async function startUpload() {
    // Replace spaces w/ underscores in dict name, remove special characters from lexeme so image converter can accept filename
    // const _dictName = dictionary.name.replace(/\s+/g, '_');
    // const _lexeme = this.entry.lx.replace(/[^a-z0-9+]+/gi, '_');
    const fileTypeSuffix = file.name.match(/\.[0-9a-z]+$/i)[0];

    const storagePath = `images/${$dictionary.id}/${
      entry.id
    }_${new Date().getTime()}${fileTypeSuffix}`;

    const customMetadata = {
      uploadedBy: $user.displayName,
      originalFileName: file.name,
    };

    // https://firebase.google.com/docs/storage/web/upload-files
    const storage = getStorage();
    const imageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(imageRef, file, { customMetadata });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progressAmount = snapshot.bytesTransferred / snapshot.totalBytes;
        console.log('Upload is ' + progressAmount * 100 + '% done');
        progress.set(progressAmount);
        switch (snapshot.state) {
          case 'paused':
            console.log('Upload is paused');
            break;
          case 'running':
            console.log('Upload is running');
            break;
        }
      },
      (err) => {
        alert(
          `${$_('misc.error', {
            default: 'Error',
          })}: ${err} - Please contact us with the image name and lexeme.`
        );
        error = err;
        // A full list of error codes is available at
        // https://firebase.google.com/docs/storage/web/handle-errors
        // switch (error.code) {
        //     case 'storage/unauthorized':
        //         // User doesn't have permission to access the object
        //         break;

        //     case 'storage/canceled':
        //         // User canceled the upload
        //         break;

        //     case 'storage/unknown':
        //         // Unknown error occurred, inspect error.serverResponse
        //         break;
        // }
      },
      () => savePhoto(storagePath)
    );
  }

  import { update } from '$sveltefire/firestorelite';
  import { dev } from '$sveltefire/config';
  import { serverTimestamp } from 'firebase/firestore/lite';
  import { user } from '$sveltefire/user';
  import { processImageUrl } from './processImageUrl';

  async function savePhoto(storagePath: string) {
    try {
      const imageProcessingUrl = `${processImageUrl}/talking-dictionaries-${
        dev ? 'dev' : 'alpha'
      }.appspot.com/${storagePath}`;

      const result = await fetch(imageProcessingUrl);
      const url = await result.text();
      const gcsPath = url.replace('http://lh3.googleusercontent.com/', '');

      const pf: IPhoto = {
        path: storagePath,
        gcs: gcsPath,
        ts: serverTimestamp(),
        cr: $user.displayName,
        ab: $user.uid,
      };
      await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, { pf }, true);
      success = true;
    } catch (err) {
      error = err;
      alert(
        `${$_('misc.error', {
          default: 'Error',
        })}: ${err} - Please contact us with the image name and lexeme.`
      );
    }
  }
</script>

<div
  class="w-full h-full relative flex flex-col items-center justify-center
  overflow-hidden"
>
  {#if error}
    <div class="w-12 text-red-600 text-center">
      <i class="far fa-times" />
      {$_('misc.error', { default: 'Error' })}
    </div>
  {:else}
    {#if success}
      <div class="w-12 text-dark-shadow text-white z-10 text-center">
        <i class="far fa-check fa-lg" />
      </div>
    {:else}
      <div
        class="text-dark-shadow text-white z-10 font-semibold w-12 text-center
        font-mono"
      >
        {percentage}%
      </div>
    {/if}
    {#if previewURL}
      <img class="object-cover h-full w-full absolute inset-0" alt="" src={previewURL} />
    {/if}
    <div style="height:{100 - percentage}%" class="bg-gray-200 opacity-75 absolute top-0 w-full" />
  {/if}
</div>
