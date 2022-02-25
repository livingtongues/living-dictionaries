<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import { updateOnline } from '$sveltefirets';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import EditString from './_EditString.svelte';
  import EditGlosses from './_EditGlosses.svelte';

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
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.settings', { default: 'Settings' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold">{$_('misc.settings', { default: 'Settings' })}</h3>
<!--TODO can I make the attibuteType dynamic?-->
<EditString
  attribute={name}
  attributeType="name"
  dictionary={$dictionary}
  display={$_('settings.edit_dict_name', { default: 'Edit Dictionary Name' })} />

<EditString
  attribute={$dictionary.iso6393}
  attributeType="iso6393"
  dictionary={$dictionary}
  display="Edit Dictionary iso6393" />

<EditString
  attribute={$dictionary.glottocode}
  attributeType="glottocode"
  dictionary={$dictionary}
  display="Edit Dictionary glottocode" />

<EditGlosses {glossLanguages} dictionary={$dictionary} />

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
