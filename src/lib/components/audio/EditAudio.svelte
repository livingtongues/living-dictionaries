<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');

  import Waveform from '$lib/components/audio/Waveform.svelte';
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte';
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte';
  import { dictionary, admin } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';

  import { deleteAudio } from '$lib/helpers/delete';
  import { firebaseConfig } from '$sveltefire/config';
  import { update } from '$sveltefire/firestorelite';

  import Collection from '$sveltefire/components/Collection.svelte';
  import { where } from 'firebase/firestore';

  import type { IEntry, ISpeaker } from '$lib/interfaces';
  export let entry: IEntry;
  let readyToRecord: boolean;
  let speakerId: string;
  let showAddSpeakerModal = false;
  let showUploadAudio = true;
  let speakers: ISpeaker[] = [];

  if (entry && entry.sf && entry.sf.sp) {
    speakerId = entry.sf.sp;
  }

  $: {
    if (speakerId === 'AddSpeaker') {
      showAddSpeakerModal = true;
      if (entry && entry.sf && entry.sf.sp) {
        speakerId = entry.sf.sp;
      } else {
        speakerId = '';
      }
    } else if (speakerId && entry && entry.sf && speakerId != entry.sf.sp) {
      updateSpeaker();
    }
  }

  async function updateSpeaker() {
    await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, { 'sf.sp': speakerId });
  }

  let file;
  let audioBlob;

  $: if (entry.sf) {
    file = undefined;
    audioBlob = undefined;
  }
</script>

<Collection
  path="speakers"
  startWith={speakers}
  on:data={(e) => (speakers = e.detail.data)}
  queryConstraints={[where('contributingTo', 'array-contains', $dictionary.id)]} />

<Modal on:close>
  <span slot="heading"> <i class="far fa-ear text-sm" /> {entry.lx} </span>

  <div class="mt-2">
    <div class="mb-3">
      {#if entry.sf && entry.sf.speakerName}
        {$_('entry.speaker', { default: 'Speaker' })}:
        {entry.sf.speakerName}
      {:else}
        {#if !speakerId}
          <div class="text-sm font-medium leading-5 text-gray-600 mt-4">
            {$_('audio.select_speaker', { default: 'Select Speaker' })}
            <!-- {#if !entry.sf}to record audio{/if} -->
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
      {/if}
    </div>

    {#if entry.sf}
      <div class="px-1">
        <Waveform
          audioUrl={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${entry.sf.path.replace(/\//g, '%2F')}?alt=media`} />
      </div>
    {:else if speakerId}
      {#if file}
        <Waveform audioUrl={URL.createObjectURL(file)} />
        <div class="mb-3" />
        {#if showUploadAudio}
          {#await import('$lib/components/audio/UploadAudio.svelte') then { default: UploadAudio }}
            <UploadAudio
              {file}
              {entry}
              {speakerId}
              on:close={() => {
                showUploadAudio = false;
              }} />
          {/await}
        {/if}
      {:else if audioBlob}
        <Waveform {audioBlob} />
        <div class="mb-3" />
        {#if showUploadAudio}
          {#await import('$lib/components/audio/UploadAudio.svelte') then { default: UploadAudio }}
            <UploadAudio
              file={audioBlob}
              {entry}
              {speakerId}
              on:close={() => {
                showUploadAudio = false;
              }} />
          {/await}
        {/if}
      {:else}
        <div class="flex flex-col sm:flex-row">
          <div class="{readyToRecord ? 'w-full' : 'sm:w-1/2 sm:px-1'} mb-2 sm:mb-0">
            <RecordAudio bind:audioBlob bind:permissionGranted={readyToRecord} />
          </div>
          {#if !readyToRecord}
            <div class="sm:w-1/2 sm:px-1">
              <SelectAudio bind:file />
            </div>
          {/if}
        </div>
      {/if}
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

      <Button
        href={`https://firebasestorage.googleapis.com/v0/b/${
          firebaseConfig.storageBucket
        }/o/${entry.sf.path.replace(/\//g, '%2F')}?alt=media`}
        target="_blank">
        <i class="fas fa-download" />
        <span class="hidden sm:inline"
          >{$_('misc.download', {
            default: 'Download',
          })}</span>
      </Button>
      <div class="w-1" />

      <Button onclick={() => deleteAudio(entry)} color="red">
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
  {#await import('$lib/components/audio/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on:close={() => {
        showAddSpeakerModal = false;
      }}
      on:newSpeaker={(event) => {
        speakerId = event.detail.id;
      }} />
  {/await}
{/if}
