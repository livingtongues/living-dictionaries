<script context="module" lang="ts">
  let last_selected_speaker_id: string
</script>

<script lang="ts">
  import type { ISpeaker } from '@living-dictionaries/types'
  import { page } from '$app/stores'

  export let speakers: ISpeaker[]
  export let select_speaker: (speaker_id: string) => Promise<void> = undefined
  export let add_speaker: (speaker: ISpeaker) => Promise<string>
  export let initialSpeakerId: string = undefined

  const addSpeaker = 'AddSpeaker'
  $: speakerId = initialSpeakerId || last_selected_speaker_id

  function autofocus(node: HTMLSelectElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

{#if !speakerId}
  <div class="text-sm font-medium leading-5 text-gray-600 mb-2">
    {$page.data.t('audio.select_speaker')}
  </div>
{/if}

<div class="flex rounded-md shadow-sm mb-4">
  <label
    for="speaker"
    class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
      border-gray-300 bg-gray-50 text-gray-500">
    {$page.data.t('entry_field.speaker')}
  </label>
  <select
    use:autofocus
    bind:value={speakerId}
    on:change={() => {
      // Currently means you can't remove a speaker
      if (speakerId && speakerId !== addSpeaker) {
        last_selected_speaker_id = speakerId
        select_speaker?.(speakerId)
      }
    }}
    class="block w-full pl-3 !rounded-none ltr:!rounded-r-md rtl:!rounded-l-md form-input hover:outline-blue-600">
    {#if !speakerId}
      <option />
    {/if}
    {#each speakers as speaker}
      <option value={speaker.id}>
        {speaker.displayName}
      </option>
    {/each}
    <option value={addSpeaker}>
      +
      {$page.data.t('misc.add')}
    </option>
  </select>
</div>

{#if speakerId === addSpeaker}
  {#await import('$lib/components/media/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on_close={() => {
        speakerId = ''
      }}
      on_add_speaker={async (speaker) => {
        speakerId = await add_speaker(speaker)
        select_speaker?.(speakerId)
      }} />
  {/await}
{/if}

<slot {speakerId} />
