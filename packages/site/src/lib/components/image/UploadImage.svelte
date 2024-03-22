<script lang="ts">
  import { page } from '$app/stores';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';
  import { firebaseConfig, authState } from 'sveltefirets';
  import type { ImageUrlRequestBody, ImageUrlResponseBody } from '$api/image_url/+server';
  import { get } from 'svelte/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import { post_request } from '$lib/helpers/get-post-requests';

  export let file: File;
  export let fileLocationPrefix: string;
  $: ({user} = $page.data)


  const progress = tweened(0, {
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

  function startUpload(storagePath: string) {
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
        console.info('Upload is ' + progressAmount * 100 + '% done');
        progress.set(progressAmount);
        switch (snapshot.state) {
          case 'paused':
            console.info('Upload is paused');
            break;
          case 'running':
            console.info('Upload is running');
            break;
        }
      },
      // https://firebase.google.com/docs/storage/web/handle-errors
      (err) => {
        alert(
          `${$page.data.t('misc.error')}: ${err} - Please contact us with the image name.`
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

      const { data, error } = await post_request<ImageUrlRequestBody, ImageUrlResponseBody>('/api/image_url', { auth_token, firebase_storage_location });

      if (error)
        throw new Error(error.message);

      dispatch('uploaded', { fb_storage_path: storagePath, specifiable_image_url: data.serving_url})

      success = true;
    } catch (err) {
      error = err;
      alert(
        `${$page.data.t('misc.error')}: ${err} - Please contact us with the image name and lexeme.`
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
      {$page.data.t('misc.error')}
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
