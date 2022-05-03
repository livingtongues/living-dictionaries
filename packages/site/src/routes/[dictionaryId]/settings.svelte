<script lang="ts">
  import { t } from 'svelte-i18n';
  import { admin, dictionary as dictionaryStore } from '$lib/stores';
  import { update, updateOnline } from '$sveltefirets';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import EditString from './_EditString.svelte';
  import { arrayRemove, arrayUnion, GeoPoint } from 'firebase/firestore';
  import type { IDictionary } from '@ld/types';
  import Doc from '$sveltefirets/components/Doc.svelte';
  import {
    EditableCoordinatesField,
    EditableGlossesField,
    PublicCheckbox,
    glossingLanguages,
    EditableAlternateNames
  } from '@ld/parts';

  async function togglePublic(settingPublic: boolean) {
    try {
      if (!settingPublic) {
        await updateOnline<IDictionary>(`dictionaries/${$dictionaryStore.id}`, {
          public: false,
        });
      } else if ($admin) {
        await updateOnline<IDictionary>(`dictionaries/${$dictionaryStore.id}`, {
          public: true,
        });
      } else {
        if (
          confirm(
            `${$t('settings.community_permission', {
              default: 'Does the speech community allow this language to be online?',
            })}`
          )
        ) {
          alert(t ? $t('header.contact_us') : 'Contact Us');
        }
        location.reload();
      }
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<Doc
  path={`dictionaries/${$dictionaryStore.id}`}
  startWith={$dictionaryStore}
  let:data={dictionary}
  on:data={(e) => dictionaryStore.set(e.detail.data)}>
  <div style="max-width: 700px">
    <h3 class="text-xl font-semibold mb-4">{$t('misc.settings', { default: 'Settings' })}</h3>

    <EditString
      value={dictionary.name}
      minlength={2}
      required
      id="name"
      save={async (name) =>
        await updateOnline(`dictionaries/${$dictionaryStore.id}`, {
          name,
        })}
      display={$t('settings.edit_dict_name', { default: 'Edit Dictionary Name' })} />
    <div class="mb-5" />

    <EditString
      value={dictionary.iso6393}
      id="iso6393"
      save={async (iso6393) =>
        await updateOnline(`dictionaries/${$dictionaryStore.id}`, {
          iso6393,
        })}
      display="ISO 639-3" />
    <div class="mb-5" />

    <EditString
      value={dictionary.glottocode}
      id="glottocode"
      save={async (glottocode) =>
        await updateOnline(`dictionaries/${$dictionaryStore.id}`, {
          glottocode,
        })}
      display="Glottocode" />
    <div class="mb-5" />

    <EditString
      value={dictionary.location}
      id="location"
      save={async (location) =>
        await updateOnline(`dictionaries/${$dictionaryStore.id}`, {
          location,
        })}
      display={$t('dictionary.location', { default: 'Location' })} />
    <div class="mb-5" />

    <EditableGlossesField
      {t}
      minimum={1}
      availableLanguages={glossingLanguages}
      selectedLanguages={dictionary.glossLanguages}
      on:add={(e) => {
        update(`dictionaries/${dictionary.id}`, {
          glossLanguages: arrayUnion(e.detail.languageId),
        });
      }}
      on:remove={(e) => {
        if (admin) {
          if (
            confirm('Remove as admin? Know that regular editors get a message saying "Contact Us"')
          ) {
            update(`dictionaries/${dictionary.id}`, {
              glossLanguages: arrayRemove(e.detail.languageId),
            });
          }
        } else {
          alert(t ? $t('header.contact_us') : 'Contact Us');
        }
      }} />
    <div class="mb-5" />

    <EditableAlternateNames 
      alternateNames={dictionary.alternateNames} 
      on:update={(e) => {
        update(`dictionaries/${dictionary.id}`, {
          alternateNames: e.detail.alternateNames,
        });
      }} />
    <div class="mb-5" />

    <EditableCoordinatesField
      {t}
      lng={dictionary.coordinates ? dictionary.coordinates.longitude : undefined}
      lat={dictionary.coordinates ? dictionary.coordinates.latitude : undefined}
      on:update={(e) => {
        update(`dictionaries/${dictionary.id}`, {
          coordinates: new GeoPoint(e.detail.lat, e.detail.lng),
        });
      }}
      on:remove={() => {
        update(`dictionaries/${dictionary.id}`, { coordinates: null });
      }} />
    <div class="mb-5" />

    <PublicCheckbox
      {t}
      checked={dictionary.public}
      on:changed={({ detail: { checked } }) => togglePublic(checked)} />
    <div class="mb-5" />

    <ShowHide let:show let:toggle>
      <Button onclick={toggle} class=mb-5>
        {$t('settings.optional_data_fields', { default: 'Optional Data Fields' })}:
        {$t('header.contact_us', { default: 'Contact Us' })}
      </Button>

      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>

    {#if $admin > 1}
      {#await import('svelte-pieces/data/JSON.svelte') then { default: JSON }}
        <div class="mt-5">
          <JSON obj={dictionary} />
        </div>
      {/await}
    {/if}
  </div></Doc>

<svelte:head>
  <title>
    {$dictionaryStore.name}
    {$t('misc.settings', { default: 'Settings' })}
  </title>
</svelte:head>
