<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  import { updateOnline } from '$sveltefirets';
  import { attr } from 'svelte/internal';

  export let attribute: string;
  export let attributeType: 'name' | 'iso6393' | 'glottocode';
  export let dictionary: IDictionary;
  export let display: string;
  async function save() {
    try {
      attribute =
        attributeType === 'name'
          ? attribute.trim().replace(/^./, attribute[0].toUpperCase())
          : attribute.trim();
      await updateOnline(
        `dictionaries/${dictionary.id}`,
        JSON.parse(`{"${attributeType}": "${attribute}"}`)
      );
      if (attributeType === 'name') {
        dictionary.name = attribute;
      }
      location.reload();
    } catch (err) {
      if (attributeType === 'name') {
        attribute = dictionary.name;
      }
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<form class="mt-4" on:submit|preventDefault={save}>
  <label for={attribute} class="block text-xs leading-5 text-gray-700 mb-1">
    {display}
  </label>
  <div class="flex flex-grow rounded-md shadow-sm">
    <div class="flex-grow focus-within:z-10">
      <input
        id={attribute}
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        minlength="2"
        required
        bind:value={attribute}
        class="appearance-none rounded-none block w-full px-3 py-2 border
          border-gray-300 ltr:rounded-l-md rtl:rounded-r-md text-gray-900 placeholder-gray-400
          focus:outline-none focus:shadow-outline-blue focus:border-blue-300
          sm:text-sm sm:leading-5 transition ease-in-out duration-150"
        placeholder={$_('settings.dict_name', {
          default: 'Dictionary Name',
        })} />
    </div>
    <button
      type="submit"
      class="-ml-px relative flex items-center px-3 py-2 ltr:rounded-r-md rtl:rounded-l-md border
        border-gray-300 text-sm leading-5 bg-gray-50 text-gray-900
        focus:outline-none focus:shadow-outline-blue focus:border-blue-300
        focus:z-10 transition ease-in-out duration-150">
      {$_('misc.save', { default: 'Save' })}
      <!-- <span class="hidden sm:inline">Name</span> -->
    </button>
  </div>
</form>
