<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import RecordVideo from '$lib/components/video/RecordVideo.svelte';
  import { firebaseConfig } from '$sveltefire/config';
  import { admin } from '$lib/stores';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry;

  let readyToRecord: boolean;
  let uploadVideoRequest = false;
  const uploadVideo = () => (uploadVideoRequest = true);
  let file;
  let videoBlob;

  $: if (entry.vf) {
    file = undefined;
    videoBlob = undefined;
  }
  $: console.log('videoblob', videoBlob);
</script>

<Modal on:close>
  <span slot="heading"> <i class="far fa-video-plus text-sm" /> {entry.lx} </span>

  <div class="mt-2">
    <!-- <div class="mb-3">
      {#if entry.vf}
        {entry.id}
      {/if}
    </div> -->
    {#if entry.vf}
      <div class="px-1">
        <!-- svelte-ignore a11y-media-has-caption -->
        <video
          controls
          autoplay
          playsinline
          src={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${entry.vf.path.replace(/\//g, '%2F')}?alt=media`} />
      </div>
    {:else}
      <div class="flex flex-col sm:flex-row">
        <div class="{readyToRecord ? 'w-full' : 'sm:w-1/2 sm:px-1'} mb-2 sm:mb-0">
          <RecordVideo {uploadVideo} bind:videoBlob bind:permissionGranted={readyToRecord} />
        </div>
      </div>
    {/if}
    {#if videoBlob && uploadVideoRequest}
      {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
        <UploadVideo
          file={videoBlob}
          {entry}
          on:close={() => {
            uploadVideoRequest = false;
          }} />
      {/await}
    {/if}
  </div>

  <div class="modal-footer">
    {#if entry.sf}
      {#if $admin > 1}
        {#await import('$svelteui/data/JSON.svelte') then { default: JSON }}
          <JSON obj={entry} />
          <div class="w-1" />
        {/await}
      {/if}
    {/if}
    <Button onclick={close} color="black">
      {$_('misc.close', { default: 'Close' })}
    </Button>
  </div>
</Modal>
