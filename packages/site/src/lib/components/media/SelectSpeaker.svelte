<script module lang="ts">
  let last_selected_speaker_id: string
</script>

<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  interface Props {
    select_speaker?: (speaker_id: string) => Promise<void>;
    initialSpeakerId?: string;
    children?: import('svelte').Snippet<[any]>;
  }

  let { select_speaker = undefined, initialSpeakerId = undefined, children }: Props = $props();

  let { speakers } = $derived($page.data)

  const addSpeaker = 'AddSpeaker'
  let speaker_id = $derived(initialSpeakerId || last_selected_speaker_id)

  function autofocus(node: HTMLSelectElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

{#if !speaker_id}
  <div class="text-sm font-medium leading-5 text-gray-600 mb-2">
    {$page.data.t('audio.select_speaker')}
  </div>
{/if}

{#if !$speakers?.length}
  <Button onclick={() => speaker_id = addSpeaker} form="filled"><span class="i-fa-solid-plus -mt-1"></span> {$page.data.t('misc.add')}</Button>
{:else}
  <div class="flex rounded-md shadow-sm mb-4">
    <label
      for="speaker"
      class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
        border-gray-300 bg-gray-50 text-gray-500">
      {$page.data.t('entry_field.speaker')}
    </label>
    <select
      use:autofocus
      bind:value={speaker_id}
      onchange={() => {
        // Currently means you can't remove a speaker
        if (speaker_id && speaker_id !== addSpeaker) {
          last_selected_speaker_id = speaker_id
          select_speaker?.(speaker_id)
        }
      }}
      class="block w-full pl-3 !rounded-none ltr:!rounded-r-md rtl:!rounded-l-md form-input hover:outline-blue-600">
      {#if !speaker_id}
        <option></option>
      {/if}
      {#each $speakers as speaker}
        <option value={speaker.id}>
          {speaker.name}
        </option>
      {/each}
      <option value={addSpeaker}>
        +
        {$page.data.t('misc.add')}
      </option>
    </select>
  </div>
{/if}

{#if speaker_id === addSpeaker}
  {#await import('$lib/components/media/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on_close={() => speaker_id = ''}
      on_speaker_added={(new_speaker_id) => {
        speaker_id = new_speaker_id
        select_speaker?.(new_speaker_id)
      }} />
  {/await}
{:else if speaker_id}
  {@render children?.({ speaker_id, })}
{/if}
