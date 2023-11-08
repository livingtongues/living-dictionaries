<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { dictionary } from '$lib/stores';
  import { Button, Form, Modal } from 'svelte-pieces';
  import { addOnline } from 'sveltefirets';
  import type { ISpeaker } from '@living-dictionaries/types';
  import { decades } from './ages';

  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');

  let displayName = '';
  let birthplace = '';
  let decade = 4;
  let gender: ISpeaker['gender'] = 'm';
  let agreeToBeOnline = true;

  async function addSpeaker() {
    const speaker = {
      displayName: displayName.trim(),
      birthplace: birthplace.trim(),
      decade,
      gender,
      contributingTo: [$dictionary.id],
    };

    const { id } = await addOnline<ISpeaker>('speakers', speaker);
    dispatch('newSpeaker', { id });
  }
</script>

<Modal on:close>
  <span slot="heading">{$page.data.t('speakers.add_new_speaker')}
  </span>

  <Form let:loading onsubmit={addSpeaker}>
    <label for="name" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$page.data.t('speakers.name')}
    </label>
    <div class="mt-1 rounded-md shadow-sm">
      <input
        id="name"
        type="text"
        required
        bind:value={displayName}
        class="form-input block w-full" />
    </div>

    <label for="birthplace" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$page.data.t('speakers.birthplace')}
    </label>
    <div class="mt-1 rounded-md shadow-sm">
      <input
        id="birthplace"
        type="text"
        required
        bind:value={birthplace}
        class="form-input block w-full" />
    </div>

    <label for="age" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$page.data.t('speakers.age_range')}
    </label>
    <div class="mt-1 rounded-md shadow-sm">
      <select id="age" bind:value={decade} class="form-input block w-full">
        {#each Object.entries(decades) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </div>

    <div class="font-medium text-sm text-gray-700 mt-4">
      {$page.data.t('speakers.gender')}
    </div>
    <div class="flex">
      <div class="mt-2 flex items-center">
        <input id="male" type="radio" bind:group={gender} value="m" />
        <div class="w-2" />
        <label for="male">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$page.data.t('speakers.male')}
          </span>
        </label>
      </div>
      <div class="w-3" />
      <div class="mt-2 flex items-center">
        <input id="female" type="radio" bind:group={gender} value="f" />
        <div class="w-2" />
        <label for="female">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$page.data.t('speakers.female')}
          </span>
        </label>
      </div>
      <div class="w-3" />
      <div class="mt-2 flex items-center">
        <input id="other" type="radio" bind:group={gender} value="o" />
        <div class="w-2" />
        <label for="other">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$page.data.t('speakers.other')}
          </span>
        </label>
      </div>
    </div>

    <div class="flex items-center mt-6">
      <input id="agree" type="checkbox" required bind:checked={agreeToBeOnline} />
      <div class="w-2" />
      <label for="agree" class="block text-sm leading-5 text-gray-900">
        {$page.data.t('speakers.speaker_agrees')}
      </label>
    </div>

    <!-- TODO: "The speaker is me" checkbox -->

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$page.data.t('misc.cancel')}
      </Button>
      <Button type="submit" form="filled" {loading}>
        {$page.data.t('misc.save')}
      </Button>
    </div>
  </Form>
</Modal>
