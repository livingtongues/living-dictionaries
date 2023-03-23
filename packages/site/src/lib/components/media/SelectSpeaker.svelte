<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Collection } from 'sveltefirets';
  import { where } from 'firebase/firestore';
  import { canEdit } from '$lib/stores';

  export let dictionaryId: string,
    dialect: string | string[] = undefined, // string[] it's only to avoid lint, for now it's only a string
    initialSpeakerId: string = undefined;
  const addSpeaker = 'AddSpeaker';
  $: speakerId = initialSpeakerId;
  $: speaker = speakers.find(speaker => speaker.id === speakerId);

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
    {$_('audio.select_speaker', { default: 'Select Speaker' })}
  </div>
{/if}

<div class="flex rounded-md shadow-sm mb-2">
  {#if $canEdit}
    <label
      for="speaker"
      class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
    border-gray-300 bg-gray-50 text-gray-500">
      {$_('entry.speaker', { default: 'Speaker' })}
    </label>
    <select
      use:autofocus
      bind:value={speakerId}
      on:change={() => {
        console.log({ speakerId });
        if (speakerId && speakerId !== addSpeaker) {
          dispatch('update', { speakerId });
        }
      }}
      use:autofocus
      class="block w-full pl-3 !rounded-none ltr:!rounded-r-md rtl:!rounded-l-md form-input hover:outline-blue-600"> 
      <option />
        {#each speakers as speaker}
          <option value={speaker.id}>
            {speaker.displayName}
          </option>
        {/each}
      <option value={addSpeaker}>
        +
        {$_('misc.add', { default: 'Add' })}
      </option>
    </select>
  {:else}
    <p>{$_('entry.speaker', { default: 'Speaker' })}: {speaker?.displayName}</p>
  {/if}
</div>
{#if speakerId}
  <div class="mb-4 text-xs">
    {#if typeof speaker?.decade === 'number'}<p>{$_('speakers.age_range', { default: 'Age Range' })}: {speaker.decade*10+1}-{(speaker.decade+1)*10}</p>{/if}
    {#if speaker?.birthplace}<p>{$_('speakers.birthplace', { default: 'Birthplace' })}: {speaker?.birthplace}</p>{/if}
    {#if dialect}<p>{$_('entry.di', { default: 'Dialect' })}: {dialect}</p>{/if}
  </div>
{/if}

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
