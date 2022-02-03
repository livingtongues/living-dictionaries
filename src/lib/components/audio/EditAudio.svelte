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

  import type { IEntry } from '$lib/interfaces';
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte';
  import { update } from '$sveltefire/firestorelite';

  export let entry: IEntry;

  let readyToRecord: boolean;
  let showUploadAudio = true;

  let file;
  let audioBlob;

  $: if (entry.sf) {
    file = undefined;
    audioBlob = undefined;
  }
</script>

<Modal on:close>
  <span slot="heading"> <i class="far fa-ear text-sm" /> {entry.lx} </span>

  {#if entry.sf && entry.sf.speakerName}
    <div class="mb-4">
      {$_('entry.speaker', { default: 'Speaker' })}:
      {entry.sf.speakerName}
    </div>
    <Waveform
      audioUrl={`https://firebasestorage.googleapis.com/v0/b/${
        firebaseConfig.storageBucket
      }/o/${entry.sf.path.replace(/\//g, '%2F')}?alt=media`} />
  {:else}
    <SelectSpeaker
      dictionaryId={$dictionary.id}
      initialSpeakerId={(entry.sf && entry.sf.sp) || null}
      let:speakerId
      on:update={async ({ detail }) => {
        if (entry.sf && detail.speakerId != entry.sf.sp) {
          await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, {
            'sf.sp': detail.speakerId,
          });
        }
      }}>
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
