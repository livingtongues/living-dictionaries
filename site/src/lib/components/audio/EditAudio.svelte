<script lang="ts">
  import IconDownload from '~icons/fa-solid/download'
  import IconTrashAlt from '~icons/fa-regular/trash-alt'
  import type { EntryData } from '$lib/types'
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import { add_audio } from '$lib/media/add-media'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import JSON from '$lib/components/ui/JSON.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
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
  const { auth_user, writes, url_from_storage_path } = $derived(page.data)
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: page.data.dictionary?.orthographies }))
  // Must match RecordAudio's $bindable fallbacks (permissionGranted = false, audioBlob = null):
  // binding an `undefined` $state to a prop with a non-undefined fallback throws Svelte's
  // `props_invalid_value` at runtime, which crashed the audio editor (no record/upload UI showed).
  let readyToRecord: boolean = $state(false)

  let file: File = $state()
  let audioBlob: Blob = $state(null)

  $effect(() => {
    if (sound_file) {
      file = undefined
      audioBlob = null
    }
  })

  const initial_speaker_id = $derived(sound_file?.speakers?.[0].id)
  const initial_source_slug = $derived(sound_file?.source ?? undefined)

  function start_upload({ speaker_id, source_slug }: { speaker_id?: string, source_slug?: string }): MediaUploadHandle {
    const handle = add_audio({
      writes,
      dictionary_id: page.data.dictionary.id,
      file: file || audioBlob,
      entry_id: entry.id,
      speaker_id,
      source: source_slug,
    })
    handle.done.then(() => upload_triggered = true).catch(() => undefined) // error renders in the progress pill
    return handle
  }

  async function select_speaker(new_speaker_id: string) {
    if (!sound_file) return
    if (initial_speaker_id === new_speaker_id) return

    if (initial_speaker_id)
      await writes.assign_speaker({ speaker_id: initial_speaker_id, media: 'audio', media_id: sound_file.id, remove: true })
    await writes.assign_speaker({ speaker_id: new_speaker_id, media: 'audio', media_id: sound_file.id })
  }

  async function select_source(new_source_slug: string) {
    if (!sound_file) return
    if (sound_file.source === new_source_slug) return
    await writes.update_audio({ id: sound_file.id, source: new_source_slug })
  }
</script>

<Modal on_close={on_close}>
  {#snippet heading()}
    <span> <IconMaterialSymbolsHearing style="font-size: 0.875rem" /> {headword.value} </span>
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
            {@const handle = start_upload({ speaker_id, source_slug })}
            {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
              <UploadProgressBarStatus {handle} />
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
      {#if auth_user.admin_level >= 3}
        <JSON obj={sound_file} />
        <div style="width: 0.25rem"></div>
      {/if}

      <HeadlessButton class="btn btn-default" href={url_from_storage_path(sound_file.storage_path)} target="_blank">
        <IconDownload />
        <span class="wide-only">{page.data.t('misc.download')}</span>
      </HeadlessButton>
      <div style="width: 0.25rem"></div>

      <HeadlessButton
        style="color: var(--danger)"
        class="btn btn-default"
        onclick={async () => {
          const confirmation = confirm(page.data.t('entry.delete_audio'))
          if (confirmation) await writes.delete_audio(sound_file.id)
          on_close()
        }}>
        <IconTrashAlt />&nbsp;
        <span class="wide-only">{page.data.t('misc.delete')}</span>
      </HeadlessButton>
      <div style="width: 0.25rem"></div>
    {/if}

    <HeadlessButton class="btn btn-default" onclick={on_close}>
      {page.data.t('misc.close')}
    </HeadlessButton>
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
