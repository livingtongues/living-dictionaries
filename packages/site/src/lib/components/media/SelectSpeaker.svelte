<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Collection } from 'sveltefirets';
  import { where } from 'firebase/firestore';

  export let dictionaryId: string;
  export let initialSpeakerId: string = undefined;

  const addSpeaker = 'AddSpeaker';
  $: speakerId = initialSpeakerId;

  import type { ISpeaker } from '@living-dictionaries/types';
  let speakers: ISpeaker[] = [];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ update: { speakerId: string } }>();

  function autofocus(node: HTMLSelectElement) {
    setTimeout(() => node.focus(), 5);
  }
</script>

<Collection
  path="speakers"
  startWith={speakers}
  on:data={(e) => (speakers = e.detail.data)}
  queryConstraints={[where('contributingTo', 'array-contains', dictionaryId)]} />

{#if !speakerId}
  <div class="text-sm font-medium leading-5 text-gray-600 mb-2">
    {$t('audio.select_speaker', { default: 'Select Speaker' })}
  </div>
{/if}

<div class="flex rounded-md shadow-sm mb-4">
  <label
    for="speaker"
    class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
  border-gray-300 bg-gray-50 text-gray-500">
    {$t('entry.speaker', { default: 'Speaker' })}
  </label>
  <select
    use:autofocus
    bind:value={speakerId}
    on:change={() => {
      // Currently means you can't remove a speaker
      if (speakerId && speakerId !== addSpeaker) {
        dispatch('update', { speakerId });
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
      {$t('misc.add', { default: 'Add' })}
    </option>
  </select>
</div>

{#if speakerId === addSpeaker}
  {#await import('$lib/components/media/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on:close={() => {
        speakerId = '';
      }}
      on:newSpeaker={(event) => {
        speakerId = event.detail.id;
      }} />
  {/await}
{/if}

<slot {speakerId} />
