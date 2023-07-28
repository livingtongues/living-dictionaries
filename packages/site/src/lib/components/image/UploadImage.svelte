<script lang="ts">
  import { t } from 'svelte-i18n';
  import { user } from '$lib/stores';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';
  import { firebaseConfig, authState } from 'sveltefirets';
  import { apiFetch } from '$lib/client/apiFetch';
  import type { ImageUrlRequestBody } from '../../../routes/api/image_url/+server';
  import { get } from 'svelte/store';
  import { createEventDispatcher, onMount } from 'svelte';

  export let file: File;
  export let fileLocationPrefix: string;

  let progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);

  let error;
  let success: boolean;
  $: previewURL = URL.createObjectURL(file);

  onMount(() => {
    const fileTypeSuffix = file.name.match(/\.[0-9a-z]+$/i)[0];
    const fileLocation = `${fileLocationPrefix}${new Date().getTime()}${fileTypeSuffix}`
    startUpload(fileLocation)
  })

  const dispatch = createEventDispatcher<{uploaded: { fb_storage_path: string, specifiable_image_url: string }}>();
    
  async function startUpload(storagePath: string) {
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
      // https://firebase.google.com/docs/storage/web/handle-errors
      (err) => {
        alert(
          `${$t('misc.error', {
            default: 'Error',
          })}: ${err} - Please contact us with the image name.`
        );
        error = err;
      },
      () => savePhoto(storagePath)
    );
  }

  async function savePhoto(storagePath: string) {
    try {
      const firebase_storage_location = `${firebaseConfig.storageBucket}/${storagePath}`;

      const auth_state_user = get(authState);
      const auth_token = await auth_state_user.getIdToken();
      const response = await apiFetch<ImageUrlRequestBody>('/api/image_url', {
        auth_token,
        firebase_storage_location,
      });
      
      if (response.status !== 200) {
        throw new Error(`Error getting image serving url.`);
      }
      const gcsPath = await response.json() as string

      dispatch('uploaded', { fb_storage_path: storagePath, specifiable_image_url: gcsPath})

      success = true;
    } catch (err) {
      error = err;
      alert(
        `${$t('misc.error', {
          default: 'Error',
        })}: ${err} - Please contact us with the image name and lexeme.`
      );
    }
  }
</script>

<div
  class="w-full h-full flex-grow relative flex flex-col items-center justify-center
  overflow-hidden">
  {#if error}
    <div class="w-12 text-red-600 text-center">
      <i class="far fa-times" />
      {$t('misc.error', { default: 'Error' })}
    </div>
  {:else}
    {#if success}
      <div class="w-12 text-dark-shadow text-white z-10 text-center">
        <i class="far fa-check fa-lg" />
      </div>
    {:else}
      <div
        class="text-dark-shadow text-white z-10 font-semibold w-12 text-center
        font-mono">
        {percentage}%
      </div>
    {/if}
    {#if previewURL}
      <img class="object-cover h-full w-full absolute inset-0" alt="" src={previewURL} />
    {/if}
    <div style="height:{100 - percentage}%" class="bg-gray-200 opacity-75 absolute top-0 w-full" />
  {/if}
</div>
