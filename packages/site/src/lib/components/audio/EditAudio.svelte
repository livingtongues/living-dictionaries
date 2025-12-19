<script lang="ts">
  import type { EntryData } from '@living-dictionaries/types'

  import type { Readable } from 'svelte/store'
  import type { AudioVideoUploadStatus } from './upload-audio'
  import { page } from '$app/stores'
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte'
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte'
  import Waveform from '$lib/components/audio/Waveform.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import { Button, JSON, Modal } from '$lib/svelte-pieces'

  interface Props {
    on_close: () => void
    entry: EntryData
    sound_file: EntryData['audios'][0]
  }

  let { on_close, entry, sound_file }: Props = $props()

  let upload_triggered = $state(false)
  let { admin, dbOperations, url_from_storage_path } = $derived($page.data)
  let readyToRecord: boolean = $state()

  let file: File = $state()
  let audioBlob: Blob = $state()

  $effect(() => {
    if (sound_file) {
      file = undefined
      audioBlob = undefined
    }
  })

  let initial_speaker_id = $derived(sound_file?.speakers?.[0].id)

  function startUpload(speaker_id: string): Readable<AudioVideoUploadStatus> {
    const uploadStore = dbOperations.addAudio({
      file: file || audioBlob,
      entry_id: entry.id,
      speaker_id,
    })

    const unsubscribe = uploadStore.subscribe((status) => {
      if (status?.progress === 100) {
        upload_triggered = true
        unsubscribe()
      }
    })

    return uploadStore
  }

  async function select_speaker(new_speaker_id: string) {
    if (!sound_file) return
    if (initial_speaker_id === new_speaker_id) return

    if (initial_speaker_id)
      await dbOperations.assign_speaker({ speaker_id: initial_speaker_id, media: 'audio', media_id: sound_file.id, remove: true })
    await dbOperations.assign_speaker({ speaker_id: new_speaker_id, media: 'audio', media_id: sound_file.id })
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span> <span class="i-material-symbols-hearing text-lg text-sm"></span> {entry.main.lexeme.default} </span>
  {/snippet}

  <SelectSpeaker
    initialSpeakerId={initial_speaker_id}

    {select_speaker}>
    {#snippet children({ speaker_id })}
      {#if sound_file}
        <div class="px-1">
          <Waveform audioUrl={url_from_storage_path(sound_file.storage_path)} />
        </div>
      {:else if speaker_id}
        {#if file || audioBlob}
          {#if file}
            <Waveform audioUrl={URL.createObjectURL(file)} />
          {:else}
            <Waveform {audioBlob} />
          {/if}
          <div class="mb-3"></div>
          {#if !upload_triggered && (file || audioBlob)}
            {@const upload_status = startUpload(speaker_id)}
            {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
              <UploadProgressBarStatus {upload_status} />
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
    {/snippet}
  </SelectSpeaker>

  <div class="modal-footer">
    {#if sound_file}
      {#if $admin > 1}
        <JSON obj={sound_file} />
        <div class="w-1"></div>
      {/if}

      <Button
        href={url_from_storage_path(sound_file.storage_path)}
        target="_blank">
        <i class="fas fa-download"></i>
        <span class="hidden sm:inline">{$page.data.t('misc.download')}</span>
      </Button>
      <div class="w-1"></div>

      <Button
        onclick={async () => {
          const confirmation = confirm($page.data.t('entry.delete_audio'))
          if (confirmation) await dbOperations.update_audio({ deleted: new Date().toISOString(), id: sound_file.id })
          on_close()
        }}
        color="red">
        <i class="far fa-trash-alt"></i>&nbsp;
        <span class="hidden sm:inline">{$page.data.t('misc.delete')}</span>
      </Button>
      <div class="w-1"></div>
    {/if}

    <Button onclick={on_close} color="black">
      {$page.data.t('misc.close')}
    </Button>
  </div>
</Modal>
