<script lang="ts">
  import { page } from '$app/state'
  import IconDownload from '~icons/fa-solid/download'
  import IconTrashAlt from '~icons/fa-regular/trash-alt'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import { add_audio } from '$lib/media/add-media'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import JSON from '$lib/components/ui/JSON.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Waveform from '$lib/components/audio/Waveform.svelte'
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte'
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'

  interface Props {
    on_close: () => void
    title: string
    /** Owner — exactly one (ignored when managing an existing row). */
    text_id?: string
    sentence_id?: string
    /** Existing row → manage mode (attribution / download / delete). */
    audio?: DictRowType<'audio'> | null
  }

  const { on_close, title, text_id, sentence_id, audio = null }: Props = $props()

  const { auth_user, writes, url_from_storage_path } = $derived(page.data)

  let upload_triggered = $state(false)
  // Must match RecordAudio's $bindable fallbacks — see EditAudio's note on props_invalid_value.
  let ready_to_record: boolean = $state(false)
  let file: File = $state()
  let audio_blob: Blob = $state(null)

  const speaker_links = $derived(audio
    ? (page.data.dict_db?.audio_speakers.rows ?? []).filter(link => link.audio_id === audio.id)
    : [])
  const initial_speaker_id = $derived(speaker_links[0]?.speaker_id)
  const initial_source_slug = $derived(audio?.source ?? undefined)

  function start_upload({ speaker_id, source_slug }: { speaker_id?: string, source_slug?: string }): MediaUploadHandle {
    const handle = add_audio({
      writes,
      dictionary_id: page.data.dictionary.id,
      file: file || audio_blob,
      text_id,
      sentence_id,
      speaker_id,
      source: source_slug,
    })
    handle.done.then(() => upload_triggered = true).catch(() => undefined) // error renders in the progress pill
    return handle
  }

  async function select_speaker(new_speaker_id: string) {
    if (!audio) return
    if (initial_speaker_id === new_speaker_id) return

    if (initial_speaker_id)
      await writes.assign_speaker({ speaker_id: initial_speaker_id, media: 'audio', media_id: audio.id, remove: true })
    await writes.assign_speaker({ speaker_id: new_speaker_id, media: 'audio', media_id: audio.id })
  }

  async function select_source(new_source_slug: string) {
    if (!audio) return
    if (audio.source === new_source_slug) return
    await writes.update_audio({ id: audio.id, source: new_source_slug })
  }
</script>

<Modal on_close={on_close}>
  {#snippet heading()}
    <span> <IconMaterialSymbolsHearing style="font-size: 0.875rem" /> {title} </span>
  {/snippet}

  <SelectSpeaker
    initialSpeakerId={initial_speaker_id}
    {initial_source_slug}
    {select_speaker}
    {select_source}>
    {#snippet children({ speaker_id, source_slug })}
      {#if audio}
        <div style="padding-left: 0.25rem; padding-right: 0.25rem">
          <Waveform audioUrl={url_from_storage_path(audio.storage_path)} />
        </div>
      {:else if speaker_id || source_slug}
        {#if file || audio_blob}
          {#if file}
            <Waveform audioUrl={URL.createObjectURL(file)} />
          {:else}
            <Waveform audioBlob={audio_blob} />
          {/if}
          <div style="margin-bottom: 0.75rem"></div>
          {#if !upload_triggered && (file || audio_blob)}
            {@const handle = start_upload({ speaker_id, source_slug })}
            {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
              <UploadProgressBarStatus {handle} />
            {/await}
          {/if}
        {:else}
          <div style="display: flex; flex-direction: column">
            <div style="margin-bottom: 0.5rem">
              <RecordAudio bind:audioBlob={audio_blob} bind:permissionGranted={ready_to_record} />
            </div>
            {#if !ready_to_record}
              <SelectAudio bind:file />
            {/if}
          </div>
        {/if}
      {/if}
    {/snippet}
  </SelectSpeaker>

  <div class="modal-footer">
    {#if audio}
      {#if auth_user.admin_level >= 3}
        <JSON obj={audio} />
        <div style="width: 0.25rem"></div>
      {/if}

      <HeadlessButton class="btn btn-default" href={url_from_storage_path(audio.storage_path)} target="_blank">
        <IconDownload />
        <span class="wide-only">{page.data.t('misc.download')}</span>
      </HeadlessButton>
      <div style="width: 0.25rem"></div>

      <HeadlessButton
        style="color: var(--danger)"
        class="btn btn-default"
        onclick={async () => {
          const confirmation = confirm(page.data.t('entry.delete_audio'))
          if (confirmation) await writes.delete_audio(audio.id)
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
