<script lang="ts">
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import { dictionary } from '$lib/stores';
  import { Button, Form, Modal } from 'svelte-pieces';
  import { addOnline } from 'sveltefirets';
  import type { ISpeaker } from '@living-dictionaries/types';

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
  <span slot="heading"
    >{$t('speakers.add_new_speaker', {
      default: 'Add New Speaker',
    })}
  </span>

  <Form let:loading onsubmit={addSpeaker}>
    <label for="name" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$t('speakers.name', { default: 'Name' })}
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
      {$t('speakers.birthplace', { default: 'Birthplace' })}
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
      {$t('speakers.age_range', { default: 'Age Range' })}
    </label>
    <div class="mt-1 rounded-md shadow-sm">
      <select id="age" bind:value={decade} class="form-input block w-full">
        <option value={0}>0-10</option>
        <option value={1}>11-20</option>
        <option value={2}>21-30</option>
        <option value={3}>31-40</option>
        <option value={4}>41-50</option>
        <option value={5}>51-60</option>
        <option value={6}>61-70</option>
        <option value={7}>71-80</option>
        <option value={8}>81-90</option>
        <option value={9}>91-100</option>
      </select>
    </div>

    <div class="font-medium text-sm text-gray-700 mt-4">
      {$t('speakers.gender', { default: 'Gender' })}
    </div>
    <div class="flex">
      <div class="mt-2 flex items-center">
        <input id="male" type="radio" bind:group={gender} value="m" />
        <div class="w-2" />
        <label for="male">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$t('speakers.male', { default: 'Male' })}
          </span>
        </label>
      </div>
      <div class="w-3" />
      <div class="mt-2 flex items-center">
        <input id="female" type="radio" bind:group={gender} value="f" />
        <div class="w-2" />
        <label for="female">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$t('speakers.female', { default: 'Female' })}
          </span>
        </label>
      </div>
      <div class="w-3" />
      <div class="mt-2 flex items-center">
        <input id="other" type="radio" bind:group={gender} value="o" />
        <div class="w-2" />
        <label for="other">
          <span class="block text-sm leading-5 font-medium text-gray-700">
            {$t('speakers.other', { default: 'Other' })}
          </span>
        </label>
      </div>
    </div>

    <div class="flex items-center mt-6">
      <input id="agree" type="checkbox" required bind:checked={agreeToBeOnline} />
      <div class="w-2" />
      <label for="agree" class="block text-sm leading-5 text-gray-900">
        {$t('speakers.speaker_agrees', {
          default: 'The speaker agrees to let these recordings be publicly available online.',
        })}
      </label>
    </div>

    <!-- TODO: "The speaker is me" checkbox -->

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$t('misc.cancel', { default: 'Cancel' })}
      </Button>
      <Button type="submit" form="filled" {loading}>
        {$t('misc.save', { default: 'Save' })}
      </Button>
    </div>
  </Form>
</Modal>
