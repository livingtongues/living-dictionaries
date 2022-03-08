<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  import { updateOnline } from '$sveltefirets';
  import Button from '$svelteui/ui/Button.svelte';

  export let attribute: string;
  export let attributeType: 'name' | 'iso6393' | 'glottocode' | 'location';
  export let dictionary: IDictionary = null;
  export let display: string;
  export let creation = false;
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
    {@html display}
  </label>
  <div class="flex flex-grow rounded-md shadow-sm">
    <div class="flex-grow focus-within:z-10">
      <input
        id={attribute}
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        minlength={attributeType === 'name' ? 2 : 0}
        maxlength="30"
        required
        bind:value={attribute}
        class="appearance-none rounded-none block w-full px-3 py-2 border
          border-gray-300 ltr:rounded-l-md rtl:rounded-r-md text-gray-900 placeholder-gray-400
          focus:outline-none focus:shadow-outline-blue focus:border-blue-300
          sm:text-sm sm:leading-5 transition ease-in-out duration-150"
        placeholder={`Dictionary ${attributeType}`} />
    </div>
    {#if !creation}
      <Button type="submit" form="primary">
        {$_('misc.save', { default: 'Save' })}
      </Button>
    {/if}
  </div>
</form>
