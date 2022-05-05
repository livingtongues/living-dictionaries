<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Collection } from '$sveltefirets';
  import { where } from 'firebase/firestore';

  export let dictionaryId: string,
    initialSpeakerId: string = undefined;
  const addSpeaker = 'AddSpeaker';
  $: speakerId = initialSpeakerId;
  let currentSpeaker: ISpeaker;

  import type { ISpeaker } from '@ld/types';
  let speakers: ISpeaker[] = [];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ update: { speakerId: string } }>();
</script>

<Collection
  path="speakers"
  startWith={speakers}
  on:data={(e) => {
    speakers = e.detail.data; 
    currentSpeaker = speakers.find((e) => e.id == speakerId);
  }}
  queryConstraints={[where('contributingTo', 'array-contains', dictionaryId)]} />

{#if !speakerId}
  <div class="text-sm font-medium leading-5 text-gray-600 mb-2">
    {$_('audio.select_speaker', { default: 'Select Speaker' })}
  </div>
{/if}

<div class="flex rounded-md shadow-sm mb-2">
  <label
    for="speaker"
    class="inline-flex items-center px-3 ltr:rounded-l-md rtl:rounded-r-md border
  border-gray-300 bg-gray-50 text-gray-500">
    {$_('entry.speaker', { default: 'Speaker' })}
  </label>
  <select
    bind:value={speakerId}
    on:change={() => {
      console.log({ speakerId });
      if (speakerId && speakerId !== addSpeaker) {
        dispatch('update', { speakerId });
      }
      currentSpeaker = speakers.find((e) => e.id == speakerId);
    }}
    id="speaker"
    class="block w-full pl-3 !rounded-none ltr:!rounded-r-md rtl:!rounded-l-md form-input">
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
</div>

<div class="mb-4">
  <p><b>Birthplace:</b> {currentSpeaker?.birthplace.charAt(0).toUpperCase() + currentSpeaker?.birthplace.slice(1)}</p>
  <p><b>Gender:</b> {currentSpeaker?.gender == 'f' ? 'Female' : 'Male'}</p>
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
