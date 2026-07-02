<script lang="ts">
  import { run } from 'svelte/legacy'

  import type { Readable } from 'svelte/store'
  import type { EntryData } from '$lib/types'
  import type { AudioVideoUploadStatus } from './upload-audio'
  import { Button, JSON, Modal } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import Waveform from '$lib/components/audio/Waveform.svelte'
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte'
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'

  interface Props {
    on_close: () => void
    entry: EntryData
    sound_file: EntryData['audios'][0]
  }

  const { on_close, entry, sound_file }: Props = $props()

  let upload_triggered = $state(false)
  const { auth_user, dbOperations, url_from_storage_path } = $derived(page.data)
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: page.data.dictionary?.orthographies }))
  // Must match RecordAudio's $bindable fallbacks (permissionGranted = false, audioBlob = null):
  // binding an `undefined` $state to a prop with a non-undefined fallback throws Svelte's
  // `props_invalid_value` at runtime, which crashed the audio editor (no record/upload UI showed).
  let readyToRecord: boolean = $state(false)

  let file: File = $state()
  let audioBlob: Blob = $state(null)

  run(() => {
    if (sound_file) {
      file = undefined
      audioBlob = null
    }
  })

  const initial_speaker_id = $derived(sound_file?.speakers?.[0].id)
  const initial_source_slug = $derived(sound_file?.source ?? undefined)

  function startUpload({ speaker_id, source_slug }: { speaker_id?: string, source_slug?: string }): Readable<AudioVideoUploadStatus> {
    const uploadStore = dbOperations.addAudio({
      file: file || audioBlob,
      entry_id: entry.id,
      speaker_id,
      source: source_slug,
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

  async function select_source(new_source_slug: string) {
    if (!sound_file) return
    if (sound_file.source === new_source_slug) return
    await dbOperations.update_audio({ id: sound_file.id, source: new_source_slug })
  }
</script>

<Modal on:close={on_close}>
  {#snippet heading()}
    <span> <IconMaterialSymbolsHearing class="icon-inline" style="font-size: 0.875rem" /> {headword.value} </span>
  {/snippet}

  <SelectSpeaker
    initialSpeakerId={initial_speaker_id}
    {initial_source_slug}
    {select_speaker}
    {select_source}>
    {#snippet children({ speaker_id, source_slug })}
      {#if sound_file}
        <div style="padding-left: 0.25rem; padding-right: 0.25rem">
          <Waveform audioUrl={url_from_storage_path(sound_file.storage_path)} />
        </div>
      {:else if speaker_id || source_slug}
        {#if file || audioBlob}
          {#if file}
            <Waveform audioUrl={URL.createObjectURL(file)} />
          {:else}
            <Waveform {audioBlob} />
          {/if}
          <div style="margin-bottom: 0.75rem"></div>
          {#if !upload_triggered && (file || audioBlob)}
            {@const upload_status = startUpload({ speaker_id, source_slug })}
            {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
              <UploadProgressBarStatus {upload_status} />
            {/await}
          {/if}
        {:else}
          <div style="display: flex; flex-direction: column">
            <div style="margin-bottom: 0.5rem">
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
      {#if auth_user.admin_level > 1}
        <JSON obj={sound_file} />
        <div style="width: 0.25rem"></div>
      {/if}

      <Button
        href={url_from_storage_path(sound_file.storage_path)}
        target="_blank">
        <i class="fas fa-download"></i>
        <span class="wide-only">{page.data.t('misc.download')}</span>
      </Button>
      <div style="width: 0.25rem"></div>

      <Button
        onclick={async () => {
          const confirmation = confirm(page.data.t('entry.delete_audio'))
          if (confirmation) await dbOperations.delete_audio(sound_file.id)
          on_close()
        }}
        color="red">
        <i class="far fa-trash-alt"></i>&nbsp;
        <span class="wide-only">{page.data.t('misc.delete')}</span>
      </Button>
      <div style="width: 0.25rem"></div>
    {/if}

    <Button onclick={on_close} color="black">
      {page.data.t('misc.close')}
    </Button>
  </div>
</Modal>

<style>
  .wide-only {
    display: none;
  }

  @media (min-width: 640px) {
    .wide-only {
      display: inline;
    }
  }
</style>
