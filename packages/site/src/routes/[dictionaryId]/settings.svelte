<script lang="ts">
  import { t } from 'svelte-i18n';
  import { admin, dictionary as dictionaryStore } from '$lib/stores';
  import { update, updateOnline } from '$sveltefirets';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import { arrayRemove, arrayUnion, GeoPoint } from 'firebase/firestore';
  import type { IDictionary } from '@ld/types';
  import Doc from '$sveltefirets/components/Doc.svelte';
  import { EditableStringField, EditableCoordinatesField, EditableGlossesField, glossingLanguages } from '@ld/parts';

  async function togglePublic(settingPublic: boolean) {
    try {
      if (settingPublic) {
        const allowed = confirm(
          `${$t('settings.community_permission', {
            default: 'Does the speech community allow this language to be online?',
          })}`
        );
        if (!allowed) return;
      }
      await updateOnline<IDictionary>(`dictionaries/${$dictionaryStore.id}`, {
        public: settingPublic,
      });
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  async function save(e, dictionaryId: string, attributetype: string) { // How should I handle events with typescript?
    try {
      let attribute = e.detail.attribute
      attribute = attributetype === 'name'
        ? attribute.trim().replace(/^./, attribute[0].toUpperCase())
        : attribute.trim();
      await updateOnline(
        `dictionaries/${dictionaryId}`,
        JSON.parse(`{"${attributetype}": "${attribute}"}`)
      );
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
  <div style="max-width: 900px">
    <h3 class="text-xl font-semibold">{$t('misc.settings', { default: 'Settings' })}</h3>

    <EditableStringField 
      {t}
      required  
      attribute={dictionary.name}
      minLength={2}  
      display={$t('settings.edit_dict_name', { default: 'Edit Dictionary Name' })}
      on:save={(e) => save(e, dictionary.id, "name")} />

    <EditableStringField
      {t}
      attribute={dictionary.iso6393}
      display="ISO 639-3" 
      on:save={(e) => save(e, dictionary.id, "iso6393")} />
    
    <EditableStringField
      {t}
      attribute={dictionary.glottocode}
      display="Glottocode" 
      on:save={(e) => save(e, dictionary.id, "glottocode")} />

      <EditableStringField 
      {t}
      required  
      attribute={dictionary.location}  
      display={$t('dictionary.location', { default: 'Location' })}
      on:save={(e) => save(e, dictionary.id, "location")} />

    <div class="mt-6" />
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

    <div class="mt-6" />
    <EditableCoordinatesField
      {t}
      lng={dictionary.coordinates ? dictionary.coordinates.longitude : undefined}
      lat={dictionary.coordinates ? dictionary.coordinates.latitude : undefined}
      on:update={(event) => {
        update(`dictionaries/${dictionary.id}`, {
          coordinates: new GeoPoint(event.detail.lat, event.detail.lng),
        });
      }}
      on:remove={() => {
        update(`dictionaries/${dictionary.id}`, { coordinates: null });
      }} />

    <div class="mt-6 flex items-center">
      <input
        id="public"
        type="checkbox"
        checked={dictionary.public}
        on:change={(e) => {
          // @ts-ignore
          togglePublic(e.target.checked);
        }} />
      <label for="public" class="mx-2 block leading-5 text-gray-900">
        {$t('create.visible_to_public', { default: 'Visible to Public' })}
      </label>
    </div>
    <div class="text-xs text-gray-600 mt-1 mb-6">
      ({$t('settings.public_private_meaning', {
        default:
          'Public means anyone can see your dictionary which requires community consent. Private dictionaries are visible only to you and your collaborators.',
      })})
    </div>
  </div>

  <ShowHide let:show let:toggle>
    <Button onclick={toggle} form="filled">
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
      <JSON obj={dictionary} />
    {/await}
  {/if}
</Doc>

<svelte:head>
  <title>
    {$dictionaryStore.name}
    {$t('misc.settings', { default: 'Settings' })}
  </title>
</svelte:head>
