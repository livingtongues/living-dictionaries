<script lang="ts">
  import { Button, JSON, Modal } from 'svelte-pieces'
  import type { ExpandedAudio, ExpandedEntry, GoalDatabaseEntry } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import Waveform from '$lib/components/audio/Waveform.svelte'
  import SelectAudio from '$lib/components/audio/SelectAudio.svelte'
  import RecordAudio from '$lib/components/audio/RecordAudio.svelte'
  import { deleteAudio } from '$lib/helpers/delete'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  export let on_close: () => void
  export let entry: ExpandedEntry
  export let sound_file: ExpandedAudio
  export let updateEntryOnline: DbOperations['updateEntryOnline']
  $: ({ dictionary, admin, speakers, user } = $page.data)

  let readyToRecord: boolean
  let showUploadAudio = true

  let file: File
  let audioBlob: Blob

  $: if (sound_file) {
    file = undefined
    audioBlob = undefined
  }

  $: speaker_id = sound_file?.speaker_ids?.[0]

  async function updateSpeaker(new_speaker_id: string) {
    if (!sound_file) return
    if (speaker_id === new_speaker_id) return

    const data: GoalDatabaseEntry = {
      sfs: [
        {
          path: sound_file.fb_storage_path,
          sp: [new_speaker_id],
          // @ts-expect-error
          ts: entry.sfs[0].ts,
          ab: sound_file.uid_added_by || null,
          sc: sound_file.source || null,
          speakerName: null,
        },
      ],
    }
    await updateEntryOnline({ data, entryId: entry.id })
  }
</script>

<Modal on:close={on_close}>
  <span slot="heading"> <span class="i-material-symbols-hearing text-lg text-sm" /> {entry.lexeme} </span>

  {#if sound_file?.speakerName}
    <div class="mb-4">
      {$page.data.t('entry_field.speaker')}:
      {sound_file.speakerName}
    </div>
    <Waveform audioUrl={sound_file.storage_url} />
  {:else}
    <SelectSpeaker
      speakers={$speakers}
      initialSpeakerId={speaker_id}
      let:speakerId
      select_speaker={updateSpeaker}>
      {#if sound_file}
        <div class="px-1">
          <Waveform audioUrl={sound_file.storage_url} />
        </div>
      {:else if speakerId}
        {#if file || audioBlob}
          {#if file}
            <Waveform audioUrl={URL.createObjectURL(file)} />
          {:else}
            <Waveform {audioBlob} />
          {/if}
          <div class="mb-3" />
          {#if showUploadAudio}
            {#await import('$lib/components/audio/UploadAudio.svelte') then { default: UploadAudio }}
              <UploadAudio
                dictionary_id={$dictionary.id}
                user={$user}
                file={file || audioBlob}
                entryId={entry.id}
                {speakerId}
                on:close={() => {
                  showUploadAudio = false
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
        href={sound_file.storage_url}
        target="_blank">
        <i class="fas fa-download" />
        <span class="hidden sm:inline">{$page.data.t('misc.download')}</span>
      </Button>
      <div class="w-1" />

      <Button onclick={() => deleteAudio(entry, $dictionary.id)} color="red">
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
