<script lang="ts">
  import { Button, JSON, Modal } from 'svelte-pieces'
  import type { Readable } from 'svelte/motion'
  import type { EntryData } from '@living-dictionaries/types'
  import type { AudioVideoUploadStatus } from './upload-audio'
  import { apply_button_label } from './audio-store'
  import { page } from '$app/stores'
  import Waveform from '$lib/components/audio/Waveform.svelte'
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte'
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'

  export let on_close: () => void
  export let entry: EntryData
  export let sound_file: EntryData['audios'][0]

  let upload_triggered = false
  $: ({ admin, dbOperations, url_from_storage_path } = $page.data)
  let readyToRecord: boolean

  let file: File
  let audioBlob: Blob
  let audio_source: string
  let rights = false

  $: if (sound_file) {
    file = undefined
    audioBlob = undefined
  }

  $: initial_speaker_id = sound_file?.speakers?.[0].id

  $: if (audio_source?.length >= 10 && rights) {
    apply_button_label.set({ ready_to_upload: true })
  } else {
    apply_button_label.set({ ready_to_upload: false })
  }

  function startUpload(speaker_id: string): Readable<AudioVideoUploadStatus> {
    const uploadStore = dbOperations.addAudio({
      file: file || audioBlob,
      entry_id: entry.id,
      speaker_id,
      source: audio_source,
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

<Modal on:close={on_close}>
  <span slot="heading"> <span class="i-material-symbols-hearing text-lg text-sm" /> {entry.main.lexeme.default} </span>

  <SelectSpeaker
    initialSpeakerId={initial_speaker_id}
    let:speaker_id
    {select_speaker}>
    {#if sound_file}
      <div class="px-1">
        <Waveform audioUrl={url_from_storage_path(sound_file.storage_path)} />
      </div>
      {#if sound_file?.source}
        <p>Source: {sound_file.source}</p>
      {/if}
    {:else if speaker_id}
      {#if file || audioBlob}
        {#if file}
          <Waveform audioUrl={URL.createObjectURL(file)} />
        {:else}
          <Waveform {audioBlob} />
        {/if}
        <div class="mb-3" />
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
            <label class="block mb-2 text-sm font-medium text-gray-700" for="audio_source">
              {$page.data.t('entry.source', { values: { media: $page.data.t('entry_field.audio') } })} <i class="text-gray-500">{$page.data.t('entry.source_message', { values: { media: $page.data.t('entry.this_audio') } })}</i> (<span class="text-red-500">{$page.data.t('misc.required')}</span>)
            </label>
            <textarea
              name="audio_source"
              required
              rows="4"
              minlength="100"
              maxlength="2500"
              bind:value={audio_source}
              class="form-input w-full" />
            <div class="flex text-xs">
              <div class="text-gray-500 ml-auto">{audio_source?.length || 0}/2500</div>
            </div>
            <div class="mb-2">
              <input bind:checked={rights} type="checkbox" id="rigths" name="rigths" required />
              <label for="rigths">{$page.data.t('entry.rights', { values: { media: $page.data.t('entry.this_audio') } })} (<span class="text-red-500 font-medium">{$page.data.t('misc.required')}</span>)</label>
            </div>
            <SelectAudio bind:file />
          {/if}
        </div>
      {/if}
    {/if}
  </SelectSpeaker>

  <div class="modal-footer">
    {#if sound_file}
      {#if $admin > 1}
        <JSON obj={sound_file} />
        <div class="w-1" />
      {/if}

      <Button
        href={url_from_storage_path(sound_file.storage_path)}
        target="_blank">
        <i class="fas fa-download" />
        <span class="hidden sm:inline">{$page.data.t('misc.download')}</span>
      </Button>
      <div class="w-1" />

      <Button
        onclick={async () => {
          const confirmation = confirm($page.data.t('entry.delete_audio'))
          if (confirmation) await dbOperations.update_audio({ deleted: new Date().toISOString(), id: sound_file.id })
          on_close()
        }}
        color="red">
        <i class="far fa-trash-alt" />&nbsp;
        <span class="hidden sm:inline">{$page.data.t('misc.delete')}</span>
      </Button>
      <div class="w-1" />
    {/if}

    <Button onclick={on_close} color="black">
      {$page.data.t('misc.close')}
    </Button>
  </div>
</Modal>
