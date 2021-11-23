<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { update } from '$sveltefire/firestorelite';

  let name = $dictionary.name;
  let publicDictionary = $dictionary.public;

  async function saveName() {
    try {
      name = name.trim().replace(/^./, name[0].toUpperCase());
      await update(`dictionaries/${$dictionary.id}`, { name });
      $dictionary.name = name;
      location.reload();
    } catch (err) {
      name = $dictionary.name;
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  async function togglePublic() {
    try {
      if (publicDictionary) {
        publicDictionary = confirm(
          `${$_('settings.community_permission', {
            default: 'Does the speech community allow this language to be online?',
          })}`
        );
      }
      await update(`dictionaries/${$dictionary.id}`, { public: publicDictionary });
      $dictionary.public = publicDictionary;
    } catch (err) {
      publicDictionary = $dictionary.public;
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

<form class="mt-4" on:submit|preventDefault={saveName}>
  <label for="name" class="block text-xs leading-5 text-gray-700 mb-1">
    {$_('settings.edit_dict_name', { default: 'Edit Dictionary Name' })}
  </label>
  <div class="flex flex-grow rounded-md shadow-sm">
    <div class="flex-grow focus-within:z-10">
      <input
        id="name"
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        minlength="2"
        required
        bind:value={name}
        class="appearance-none rounded-none block w-full px-3 py-2 border
          border-gray-300 ltr:rounded-l-md rtl:rounded-r-md text-gray-900 placeholder-gray-400
          focus:outline-none focus:shadow-outline-blue focus:border-blue-300
          sm:text-sm sm:leading-5 transition ease-in-out duration-150"
        placeholder={$_('settings.dict_name', {
          default: 'Dictionary Name',
        })}
      />
    </div>
    <button
      type="submit"
      class="-ml-px relative flex items-center px-3 py-2 ltr:rounded-r-md rtl:rounded-l-md border
        border-gray-300 text-sm leading-5 bg-gray-50 text-gray-900
        focus:outline-none focus:shadow-outline-blue focus:border-blue-300
        focus:z-10 transition ease-in-out duration-150"
    >
      {$_('misc.save', { default: 'Save' })}
      <!-- <span class="hidden sm:inline">Name</span> -->
    </button>
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
