<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import RecordVideo from '$lib/components/video/RecordVideo.svelte';
  import Collection from '$sveltefire/components/Collection.svelte';
  import SelectVideo from './SelectVideo.svelte';
  import PasteVideoLink from './PasteVideoLink.svelte';
  import { deleteVideo } from '$lib/helpers/delete';
  import { update } from '$sveltefire/firestorelite';
  import { firebaseConfig } from '$sveltefire/config';
  import { dictionary, admin, canEdit } from '$lib/stores';
  import type { IEntry, ISpeaker } from '$lib/interfaces';
  import { where } from 'firebase/firestore';
  export let entry: IEntry;

  let readyToRecord: boolean;
  let speakerId: string;
  let showAddSpeakerModal = false;
  let speakers: ISpeaker[] = [];
  let uploadVideoRequest = false;
  const uploadVideo = () => (uploadVideoRequest = true);

  if (entry && entry.vf && entry.vf.sp) {
    speakerId = entry.vf.sp;
  }

  $: {
    if (speakerId === 'AddSpeaker') {
      showAddSpeakerModal = true;
      if (entry && entry.vf && entry.vf.sp) {
        speakerId = entry.vf.sp;
      } else {
        speakerId = '';
      }
    } else if (speakerId && entry && entry.vf && speakerId != entry.vf.sp) {
      updateSpeaker();
    }
  }

  async function updateSpeaker() {
    await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, { 'vf.sp': speakerId });
  }

  let file;
  let videoBlob;

  $: if (entry.vf) {
    file = undefined;
    videoBlob = undefined;
  }
</script>

<Collection
  path="speakers"
  startWith={speakers}
  on:data={(e) => (speakers = e.detail.data)}
  queryConstraints={[where('contributingTo', 'array-contains', $dictionary.id)]} />

<Modal on:close>
  <div slot="heading" class="flex justify-between mr-6">
    <span> <i class="far fa-film-alt text-sm" /> {entry.lx} </span>
    <Button form="text" type="button" size="sm" onclick={() => alert('This will be the text info')}
      ><span> <i class="fas fa-info-circle" /> </span></Button>
  </div>

  <div class="mt-2">
    <div class="mb-3">
      <!-- Not sure how to handle this -->
      {#if !entry.vf && !speakerId}
        <div class="sm:w-1/2 sm:px-1 contents">
          <!-- TODO create another component instead of a button -->
          <PasteVideoLink>Paste the link of your video</PasteVideoLink>
        </div>
      {/if}
      {#if !speakerId}
        <div class="text-sm font-medium leading-5 text-gray-600 mt-4">
          {$_('audio.select_speaker', { default: 'Select Speaker' })}
          <!-- {#if !entry.vf}to record audio{/if} -->
        </div>
      {/if}
      <div class="mt-1 flex rounded-md shadow-sm">
        <label
          for="speaker"
          class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
            border-gray-300 bg-gray-50 text-gray-500">
          {$_('entry.speaker', { default: 'Speaker' })}
        </label>
        <select
          bind:value={speakerId}
          id="speaker"
          class="block w-full pl-3 !rounded-none ltr:!rounded-r-md rtl:!rounded-l-md form-input">
          <option />
          {#each speakers as speaker}
            <option value={speaker.id}>
              {speaker.displayName}
            </option>
          {/each}
          <option value="AddSpeaker">
            +
            {$_('misc.add', { default: 'Add' })}
          </option>
        </select>
      </div>
    </div>

    {#if entry.vf}
      <div class="px-1">
        {#if $canEdit}
          <video
            controls
            autoplay
            playsinline
            src={`https://firebasestorage.googleapis.com/v0/b/${
              firebaseConfig.storageBucket
            }/o/${entry.vf.path.replace(/\//g, '%2F')}?alt=media`}>
            <track kind="captions" />
          </video>
        {:else}
          <video
            controls
            controlslist="nodownload"
            autoplay
            playsinline
            src={`https://firebasestorage.googleapis.com/v0/b/${
              firebaseConfig.storageBucket
            }/o/${entry.vf.path.replace(/\//g, '%2F')}?alt=media`}>
            <track kind="captions" />
          </video>
        {/if}
      </div>
    {:else if file}
      {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
        <UploadVideo
          {file}
          {entry}
          on:close={() => {
            uploadVideoRequest = false;
          }} />
      {/await}
    {:else if speakerId}
      <div class="flex flex-col sm:flex-row">
        <div class="{readyToRecord ? 'w-full' : 'sm:w-1/2 sm:px-1'} mb-2 sm:mb-0">
          <RecordVideo {uploadVideo} bind:videoBlob bind:permissionGranted={readyToRecord} />
        </div>
        {#if !readyToRecord}
          <div class="sm:w-1/2 sm:px-1">
            <SelectVideo bind:file />
          </div>
        {/if}
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
    {#if entry.vf && $canEdit}
      {#if $admin > 1}
        {#await import('$svelteui/data/JSON.svelte') then { default: JSON }}
          <JSON obj={entry} />
          <div class="w-1" />
        {/await}
      {/if}

      <Button
        href={`https://firebasestorage.googleapis.com/v0/b/${
          firebaseConfig.storageBucket
        }/o/${entry.vf.path.replace(/\//g, '%2F')}?alt=media`}
        target="_blank">
        <i class="fas fa-download" />
        <span class="hidden sm:inline"
          >{$_('misc.download', {
            default: 'Download',
          })}</span>
      </Button>
      <div class="w-1" />

      <Button onclick={() => deleteVideo(entry)} color="red">
        <i class="far fa-trash-alt" />&nbsp;
        <span class="hidden sm:inline"
          >{$_('misc.delete', {
            default: 'Delete',
          })}</span>
      </Button>
      <div class="w-1" />
    {/if}
    <Button onclick={close} color="black">
      {$_('misc.close', { default: 'Close' })}
    </Button>
  </div>
</Modal>
