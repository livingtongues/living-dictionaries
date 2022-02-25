<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  import { updateOnline } from '$sveltefirets';
  import { glossingLanguages } from '$lib/mappings/glossing-languages';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';

  export let glossLanguages;
  export let dictionary: IDictionary;

  async function save() {
    if (glossLanguages.length === 0) {
      return alert(
        $_('create.at_least_one_lang', {
          default: 'Choose at least 1 language to make the dictionary available in.',
        })
      );
    }
    try {
      await updateOnline(`dictionaries/${dictionary.id}`, { glossLanguages });
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<form class="mt-4" on:submit|preventDefault={save}>
  <div class="mt-6">
    <label for="glosses" class="block text-sm font-medium leading-5 text-gray-700">
      {$_('create.gloss_dictionary_in', {
        default: 'Make dictionary available in...',
      })}*
    </label>

    <div class="mt-1 rounded-md shadow-sm flex" style="direction: ltr">
      <MultiSelect
        bind:value={glossLanguages}
        preventDelete
        placeholder={$_('create.languages', { default: 'Language(s)' })}>
        {#each Object.keys(glossingLanguages) as bcp}
          <option value={bcp}>
            {glossingLanguages[bcp].vernacularName || $_('gl.' + bcp)}
            {#if glossingLanguages[bcp].vernacularAlternate}
              {glossingLanguages[bcp].vernacularAlternate}
            {/if}
            {#if glossingLanguages[bcp].vernacularName}
              <small>({$_('gl.' + bcp)})</small>
            {/if}
          </option>
        {/each}
      </MultiSelect>
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
    <div class="text-xs text-gray-600 mt-1">
      {$_('create.gloss_dictionary_clarification', {
        default: 'Language(s) you want to translate entries into',
      })}
    </div>
  </div>
</form>
