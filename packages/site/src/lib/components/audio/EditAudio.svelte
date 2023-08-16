<script lang="ts">
  import { t } from 'svelte-i18n';
  import Waveform from '$lib/components/audio/Waveform.svelte';
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte';
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte';
  import { dictionary, admin } from '$lib/stores';
  import { Modal, Button, JSON } from 'svelte-pieces';
  import { deleteAudio } from '$lib/helpers/delete';
  import type { ExpandedAudio, GoalDatabaseEntry, IEntry } from '@living-dictionaries/types';
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte';
  import { updateOnline, firebaseConfig } from 'sveltefirets';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{close: boolean}>();
  
  export let entry: IEntry;
  export let sound_file: ExpandedAudio;

  let readyToRecord: boolean;
  let showUploadAudio = true;

  let file: File;
  let audioBlob: Blob;

  $: if (sound_file) {
    file = undefined;
    audioBlob = undefined;
  }

  $: audio_url = sound_file?.fb_storage_path 
    ? `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(sound_file.fb_storage_path)}?alt=media` 
    : undefined;

  $: speaker_id = sound_file?.speaker_ids?.[0]

  async function updateSpeaker(newSpeakerId: string) {
    if(!sound_file) return;
    if (speaker_id === newSpeakerId) return;
    
    const sf = {
      ...entry.sfs[0],
      sp: [newSpeakerId]
    }
    await updateOnline<GoalDatabaseEntry>(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { sfs: [sf] },
      { abbreviate: true }
    );
  }
</script>

<Modal on:close>
  <span slot="heading"> <span class="i-material-symbols-hearing text-lg text-sm" /> {entry.lx} </span>

  {#if sound_file?.speakerName}
    <div class="mb-4">
      {$t('entry.speaker', { default: 'Speaker' })}:
      {sound_file.speakerName}
    </div>
    <Waveform audioUrl={audio_url} />
  {:else}
    <SelectSpeaker
      dictionaryId={$dictionary.id}
      initialSpeakerId={speaker_id}
      let:speakerId
      on:update={async ({ detail: {speakerId} }) => await updateSpeaker(speakerId)}>
      {#if sound_file}
        <div class="px-1">
          <Waveform audioUrl={audio_url} />
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
          <div class="flex flex-col">
            <div class="mb-2">
              <RecordAudio bind:audioBlob bind:permissionGranted={readyToRecord} />
            </div>
            {#if !readyToRecord}
              <SelectAudio bind:file />
            {/if}
          </div>
        {/if}
      {/if}
    </SelectSpeaker>
  {/if}

  <div class="modal-footer">
    {#if sound_file}
      {#if $admin > 1}
        <JSON obj={sound_file} />
        <div class="w-1" />
      {/if}

      <Button
        href={audio_url}
        target="_blank">
        <i class="fas fa-download" />
        <span class="hidden sm:inline"
          >{$t('misc.download', {
            default: 'Download',
          })}</span>
      </Button>
      <div class="w-1" />

      <Button onclick={() => deleteAudio(entry)} color="red">
        <i class="far fa-trash-alt" />&nbsp;
        <span class="hidden sm:inline"
          >{$t('misc.delete', {
            default: 'Delete',
          })}</span>
      </Button>
      <div class="w-1" />
    {/if}

    <Button onclick={() => dispatch('close')} color="black">
      {$t('misc.close', { default: 'Close' })}
    </Button>
  </div>
</Modal>
