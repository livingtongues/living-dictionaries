<script lang="ts">
  import { t } from 'svelte-i18n';
  import { admin, dictionary as dictionaryStore } from '$lib/stores';
  import { update, updateOnline, getCollection, Doc } from 'sveltefirets';
  import { Button, ShowHide, JSON } from 'svelte-pieces';
  import EditString from '../EditString.svelte';
  import { arrayRemove, arrayUnion, GeoPoint, where, limit } from 'firebase/firestore';
  import type { IDictionary, IPoint, IRegion } from '@living-dictionaries/types';
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte';
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte';
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte';
  import PublicCheckbox from '$lib/components/settings/PublicCheckbox.svelte'; // only used here - perhaps colocate
  import PrintAccessCheckbox from '$lib/components/settings/PrintAccessCheckbox.svelte'; // only used here - perhaps colocate
  import { glossingLanguages } from '$lib/glosses/glossing-languages';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  async function togglePrintAccess(settingPrintAccess: boolean) {
    try {
      if (settingPrintAccess) {
        await updateOnline<IDictionary>(`dictionaries/${$dictionaryStore.id}`, {
          printAccess: true,
        });
      } else {
        await updateOnline<IDictionary>(`dictionaries/${$dictionaryStore.id}`, {
          printAccess: false,
        });
      }
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

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
          alert($t('header.contact_us', { default: 'Contact Us' }));
        }
        location.reload();
      }
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  function updatePoints(points: IPoint[], dictionaryId: string) {
    update<IDictionary>(`dictionaries/${dictionaryId}`, {
      points,
    });
  }

  function updateRegions(regions: IRegion[], dictionaryId: string) {
    update<IDictionary>(`dictionaries/${dictionaryId}`, {
      regions,
    });
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

    <EditableGlossesField
      minimum={1}
      availableLanguages={glossingLanguages}
      selectedLanguages={dictionary.glossLanguages}
      on:add={(e) => {
        update(`dictionaries/${dictionary.id}`, {
          glossLanguages: arrayUnion(e.detail.languageId),
        });
      }}
      on:remove={async (e) => {
        try {
          // we could implement a DB filter function that tells us if at least one word in the dictionary is using this gloss
          // Or we could implement a new boolean field inside the gloses object that tells us if the gloss has been used by a word (true) or not (false)
          const entriesUsingGlossLanguage = await getCollection(
            `dictionaries/${dictionary.id}/words`,
            [where(`gl.${e.detail.languageId}`, '>', ''), limit(1)]
          );
          if (entriesUsingGlossLanguage.length == 0) {
            update(`dictionaries/${dictionary.id}`, {
              glossLanguages: arrayRemove(e.detail.languageId),
            });
          } else if ($admin) {
            if (
              confirm(
                'Remove as admin even though this glossing language is in use already? Know that regular editors get a message saying "Contact Us"'
              )
            ) {
              update(`dictionaries/${dictionary.id}`, {
                glossLanguages: arrayRemove(e.detail.languageId),
              });
            }
          } else {
            alert($t('header.contact_us', { default: 'Contact Us' }));
          }
        } catch (err) {
          return console.error(err);
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

    <WhereSpoken
      {dictionary}
      on:updateCoordinates={({ detail }) => {
        update(`dictionaries/${dictionary.id}`, {
          coordinates: new GeoPoint(detail.latitude, detail.longitude),
        });
      }}
      on:removeCoordinates={() => update(`dictionaries/${dictionary.id}`, { coordinates: null })}
      on:updatePoints={({ detail }) => updatePoints(detail, dictionary.id)}
      on:updateRegions={({ detail }) => updateRegions(detail, dictionary.id)} />
    <div class="mb-5" />

    <EditString
      value={dictionary.location}
      maxlength={100}
      id="location"
      save={async (location) =>
        await updateOnline(`dictionaries/${$dictionaryStore.id}`, {
          location,
        })}
      display={$t('dictionary.location', { default: 'Location' })} />
    <div class="mb-5" />

    <PrintAccessCheckbox
      checked={dictionary.printAccess}
      on:changed={({ detail: { checked } }) => togglePrintAccess(checked)} />
    <div class="mb-5" />

    <PublicCheckbox
      checked={dictionary.public}
      on:changed={({ detail: { checked } }) => togglePublic(checked)} />
    <div class="mb-5" />

    <ShowHide let:show let:toggle>
      <Button onclick={toggle} class="mb-5">
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
      <div class="mt-5">
        <JSON obj={dictionary} />
      </div>
    {/if}
  </div>
</Doc>

<SeoMetaTags
  title={$t('misc.settings', { default: 'Settings' })}
  dictionaryName={$dictionaryStore.name}
  description={$t('', {
    default:
      "Under Settings, dictionary managers can edit the dictionary's parameters such as its name, ISO 639-3 Code, Glottocode, translation languages, alternate names, geo-coordinates, and other information. They can also toggle on or off the ability to make the dictionary public, and the ability to make the dictionary printable to viewers.",
  })}
  keywords="Settings, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
