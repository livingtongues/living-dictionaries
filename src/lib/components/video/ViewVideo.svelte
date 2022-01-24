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
  import PasteVideoLink from './_PasteVideoLink.svelte';
  import VideoIFrame from './_VideoIFrame.svelte';
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
  let uploadVideoOption: string;
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
    <Button
      form="text"
      type="button"
      size="sm"
      onclick={() =>
        alert(
          $_('video.video_info', {
            default:
              'There are two ways to have your videos displayed in a Living Dictionary: 1) You can record your videos right here, or upload your previously recorded videos to our platform. Advantages: easy and great for quick recordings. Disadvantages: You can only upload a video up to 100MB so it must only be short and low resolution. 2) Have your videos on a hosting service that specializes in video storage and link the URL to our site. Advantages: easy (as long as your videos are already uploaded on that platform), your videos can have the resolution and length you want. Disadvantages: if you want to record something unexpected or very simple, it might be too much effort to do it that way, and you may want to prioritize method 1.',
          })
        )}><span> <i class="fas fa-info-circle" /> </span></Button>
  </div>

  <div class="mt-2">
    <div class="mb-3">
      {#if $canEdit}
        {#if !entry.vf && !speakerId && !uploadVideoOption}
          <div class="sm:w-1/2 sm:px-1 contents">
            <Button
              class="container mb-4"
              form="outline"
              color="purple"
              type="button"
              onclick={() => (uploadVideoOption = 'external')}
              ><i class="far fa-link" />
              {$_('video.paste_video_url', { default: 'Paste video URL' })}</Button>
          </div>
          <div class="sm:w-1/2 sm:px-1 contents">
            <Button
              class="container"
              form="outline"
              color="green"
              type="button"
              onclick={() => (uploadVideoOption = 'internal')}
              ><i class="far fa-box-open" />
              {$_('video.record_upload_video', { default: 'Record or upload a video' })}</Button>
          </div>
        {/if}
        {#if uploadVideoOption === 'internal'}
          {#if !entry.vf}
            <button
              type="button"
              class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
              on:click={() => {
                // We must avoid it stores any data if users change their mind at any time before upload or record a video
                uploadVideoOption = null;
                videoBlob = null;
                speakerId = '';
              }}>
              <i class="far fa-chevron-left rtl-x-flip" />
              <div class="w-1" />
              {$_('misc.back', { default: 'Back' })}
            </button>
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
              {#if !videoBlob}
                <option />
              {/if}
              {#each speakers as speaker}
                <option value={speaker.id}>
                  {speaker.displayName}
                </option>
              {/each}
              {#if !videoBlob}
                <option value="AddSpeaker">
                  +
                  {$_('misc.add', { default: 'Add' })}
                </option>
              {/if}
            </select>
          </div>
        {/if}
      {/if}
      {#if uploadVideoOption === 'external'}
        {#if !entry.vf}
          <button
            type="button"
            class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
            on:click={() => {
              // We must avoid it stores any data if users change their mind at any time before upload or record a video
              uploadVideoOption = null;
            }}>
            <i class="far fa-chevron-left rtl-x-flip" />
            <div class="w-1" />
            {$_('misc.back', { default: 'Back' })}
          </button>
          <PasteVideoLink {entry} />
        {/if}
      {/if}
    </div>

    {#if entry.vf}
      <div class="px-1">
        {#if $canEdit}
          {#if !entry.vf.externalId}
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
            <VideoIFrame videoFile={entry.vf} />
          {/if}
        {/if}
        <!-- I believe I need to be very specific in this case: when users are not able to edit -->
        {#if !$canEdit}
          {#if !entry.vf.externalId}
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
          {:else}
            <VideoIFrame videoFile={entry.vf} />
          {/if}
        {/if}
      </div>
    {:else if file}
      {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
        <UploadVideo
          {file}
          {entry}
          {speakerId}
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
          {speakerId}
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
      {#if !entry.vf.externalId}
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
      {/if}
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

{#if showAddSpeakerModal}
  {#await import('$lib/components/media/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on:close={() => {
        showAddSpeakerModal = false;
      }}
      on:newSpeaker={(event) => {
        speakerId = event.detail.id;
      }} />
  {/await}
{/if}
