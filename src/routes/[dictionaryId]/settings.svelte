<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import { updateOnline } from '$sveltefirets';
  import { glossingLanguages } from '$lib/mappings/glossing-languages';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import EditSetting from './_EditSetting.svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';

  let name = $dictionary.name;
  let publicDictionary = $dictionary.public;
  let glossLanguages = $dictionary.glossLanguages;

  async function togglePublic() {
    try {
      if (publicDictionary) {
        publicDictionary = confirm(
          `${$_('settings.community_permission', {
            default: 'Does the speech community allow this language to be online?',
          })}`
        );
      }
      await updateOnline(`dictionaries/${$dictionary.id}`, { public: publicDictionary });
      $dictionary.public = publicDictionary;
    } catch (err) {
      publicDictionary = $dictionary.public;
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  async function save() {
    if (glossLanguages.length === 0) {
      return alert(
        $_('create.at_least_one_lang', {
          default: 'Choose at least 1 language to make the dictionary available in.',
        })
      );
    }
    try {
      await updateOnline(`dictionaries/${$dictionary.id}`, { glossLanguages });
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.settings', { default: 'Settings' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold">{$_('misc.settings', { default: 'Settings' })}</h3>
<!--TODO can I make the attibuteType dynamic?-->
<EditSetting
  attribute={name}
  attributeType="name"
  dictionary={$dictionary}
  display={$_('settings.edit_dict_name', { default: 'Edit Dictionary Name' })} />

<EditSetting
  attribute={$dictionary.iso6393}
  attributeType="iso6393"
  dictionary={$dictionary}
  display="Edit Dictionary iso6393" />

<EditSetting
  attribute={$dictionary.glottocode}
  attributeType="glottocode"
  dictionary={$dictionary}
  display="Edit Dictionary glottocode" />

<!-- <select on:change={() => console.log('test')}>
  <option>1</option>
  <option>2</option>
</select> -->
<form on:submit|preventDefault={save}>
  <div class="mt-6">
    <label for="glosses" class="block text-sm font-medium leading-5 text-gray-700">
      {$_('create.gloss_dictionary_in', {
        default: 'Make dictionary available in...',
      })}*
    </label>

    <div class="mt-1 rounded-md shadow-sm flex" style="direction: ltr">
      <MultiSelect
        bind:value={glossLanguages}
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

<div class="mt-6 flex items-center">
  <input id="public" type="checkbox" bind:checked={publicDictionary} on:change={togglePublic} />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    {$_('create.visible_to_public', { default: 'Visible to Public' })}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1 mb-6">
  ({$_('settings.public_private_meaning', {
    default:
      'Public means anyone can see your dictionary which requires community consent. Private dictionaries are visible only to you and your collaborators.',
  })})
</div>

<ShowHide let:show let:toggle>
  <Button onclick={toggle} form="primary">
    {$_('settings.optional_data_fields', { default: 'Optional Data Fields' })}:
    {$_('header.contact_us', { default: 'Contact Us' })}
  </Button>

  {#if show}
    {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
      <Contact on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
