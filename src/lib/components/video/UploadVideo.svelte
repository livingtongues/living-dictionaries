<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IVideo, IEntry } from '$lib/interfaces';
  import { dictionary, user } from '$lib/stores';

  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  let progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);

  export let file: File | Blob, entry: IEntry, speakerId: string;
  let error;
  let success: boolean;

  if (file && entry) {
    startUpload();
  }

  import { updateOnline } from '$sveltefirets';
  import { serverTimestamp } from 'firebase/firestore/lite';
  import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

  async function startUpload() {
    // const _dictName = dictionary.name.replace(/\s+/g, '_');
    // const _lexeme = lexeme.replace(/\s+/g, '_');
    const fileTypeSuffix = file.type.split('/')[1];

    // const storagePath = `${_dictName}_${dictionary.id}/videos/{_lexeme}_${entryId}_${new Date().getTime()}.${fileTypeSuffix}`;
    const storagePath = `${$dictionary.id}/videos/${
      entry.id
    }_${new Date().getTime()}.${fileTypeSuffix}`;

    const customMetadata = { uploadedBy: $user.displayName };

    // https://firebase.google.com/docs/storage/web/upload-files
    const storage = getStorage();
    const videoRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(videoRef, file, { customMetadata });
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
        alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
        error = err;
      },
      async () => {
        try {
          const vf: IVideo = {
            path: storagePath,
            ts: serverTimestamp(),
            ab: $user.uid,
            sp: speakerId,
          };

          await updateOnline(
            `dictionaries/${$dictionary.id}/words/${entry.id}`,
            { vf },
            { abbreviate: true }
          );

          success = true;
        } catch (err) {
          alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
          error = err;
        }
      }
    );
  }
</script>

{#if error}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
    text-red-600 bg-red-200">
    {$_('misc.error', { default: 'Error' })}
  </span>
{:else if success}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
    text-green-600 bg-green-200">
    <i class="far fa-check" />
    {$_('upload.success', { default: 'Success' })}
  </span>
{:else}
  <div class="relative pt-1">
    <div class="flex mb-2 items-center justify-between">
      <div>
        <span
          class="text-xs font-semibold inline-block py-1 px-2 uppercase
          rounded-full text-blue-600 bg-blue-200">
          {$_('upload.uploading', { default: 'Uploading' })}
        </span>
      </div>
      <div class="text-right">
        <span class="text-xs font-semibold inline-block text-blue-600">
          {percentage}%
        </span>
      </div>
    </div>
    <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
      <div
        style="width:{percentage}%"
        class="shadow-none flex flex-col text-center whitespace-nowrap
        text-white justify-center bg-blue-500" />
    </div>
  </div>
{/if}
