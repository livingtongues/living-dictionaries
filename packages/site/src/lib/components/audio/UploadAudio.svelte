<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { GoalDatabaseAudio, GoalDatabaseEntry } from '@living-dictionaries/types';
  import { updateOnline } from 'sveltefirets';
  import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';
  import { dictionary, user } from '$lib/stores';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let file: File | Blob;
  export let entryId: string;
  export let speakerId: string;

  let progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);

  let error;
  let success: boolean;

  if (file && entryId) {
    startUpload();
  }

  async function startUpload() {
    // const _dictName = dictionary.name.replace(/\s+/g, '_');
    // const _lexeme = lexeme.replace(/\s+/g, '_');
    const fileTypeSuffix = file.type.split('/')[1];

    // const storagePath = `${_dictName}_${dictionary.id}/audio/{_lexeme}_${entryId}_${new Date().getTime()}.${fileTypeSuffix}`;
    const storagePath = `${$dictionary.id}/audio/${entryId}_${new Date().getTime()}.${fileTypeSuffix}`;
    const customMetadata = { uploadedBy: $user.displayName };

    // https://firebase.google.com/docs/storage/web/upload-files
    const storage = getStorage();
    const audioRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(audioRef, file, { customMetadata });
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
        alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
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
      async () => {
        try {
          const sf: GoalDatabaseAudio = {
            path: storagePath,
            ts: new Date().getTime(),
            ab: $user.uid,
            sp: [speakerId],
          };

          await updateOnline<GoalDatabaseEntry>(
            `dictionaries/${$dictionary.id}/words/${entryId}`,
            { sfs: [sf] },
            { abbreviate: true }
          );

          // TODO: this.speakerService.addDictionaryToSpeaker(speakerId, dictionaryId);
          success = true;
        } catch (err) {
          alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
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
    {$t('misc.error', { default: 'Error' })}
  </span>
{:else if success}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
    text-green-600 bg-green-200">
    <i class="far fa-check" />
    {$t('upload.success', { default: 'Success' })}
  </span>
{:else}
  <div class="relative pt-1">
    <div class="flex mb-2 items-center justify-between">
      <div>
        <span
          class="text-xs font-semibold inline-block py-1 px-2 uppercase
          rounded-full text-blue-600 bg-blue-200">
          {$t('upload.uploading', { default: 'Uploading' })}
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
