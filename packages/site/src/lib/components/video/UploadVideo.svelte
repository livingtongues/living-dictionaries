<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { GoalDatabaseVideo, IVideoCustomMetadata } from '@living-dictionaries/types';
  import { getStorage, ref, uploadBytesResumable, type TaskState, type UploadTask, StorageError } from 'firebase/storage';
  import { addVideo } from '$lib/helpers/media/update';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let file: File | Blob
  export let entryId: string
  export let speakerId: string;

  let uploadTask: UploadTask;
  let taskState: TaskState;
  let error: StorageError;
  let success: boolean;
  const progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);

  onMount(() => {
    if (!file || !entryId) return;

    const fileTypeSuffix = file.type.split('/')[1].split(';')[0]; // turns 'video/webm;codecs=vp8,opus' to 'webm' and 'video/mp4' to 'mp4'

    const storagePath = `${$page.data.dictionary.id}/videos/${entryId}_${new Date().getTime()}.${fileTypeSuffix}`;

    const customMetadata: IVideoCustomMetadata & Record<string, string> = {
      uploadedByUid: $page.data.user.uid,
      uploadedByName: $page.data.user.displayName,
    };

    // https://firebase.google.com/docs/storage/web/upload-files
    const storage = getStorage();
    const videoRef = ref(storage, storagePath);
    uploadTask = uploadBytesResumable(videoRef, file, { customMetadata });
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progressAmount = snapshot.bytesTransferred / snapshot.totalBytes;
        progress.set(progressAmount);
        taskState = snapshot.state;
      },
      (err) => {
        alert(`${$page.data.t('misc.error')}: ${err}`);
        error = err;
      },
      async () => {
        try {
          const database_video: GoalDatabaseVideo = {
            path: storagePath,
            ab: $page.data.user.uid,
            sp: [speakerId],
          };
          await addVideo(entryId, database_video);

          success = true;
        } catch (err) {
          alert(`${$page.data.t('misc.error')}: ${err}`);
          error = err;
        }
      }
    );
  });

  onDestroy(() => {
    if (taskState === 'paused') uploadTask.resume();
    if (taskState === 'running') uploadTask?.cancel();
  });
</script>

{#if error}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
      text-red-600 bg-red-200">
    {$page.data.t('misc.error')}
  </span>
{:else if success}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
      text-green-600 bg-green-200">
    <i class="far fa-check" />
    {$page.data.t('upload.success')}
  </span>
{:else}
  <div class="relative pt-1">
    <div class="flex mb-2 items-center justify-between">
      <div>
        <span
          class="text-xs font-semibold inline-block py-1 px-2 uppercase
            rounded-full text-blue-600 bg-blue-200">
          {$page.data.t('upload.uploading')}
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
