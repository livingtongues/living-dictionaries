<script lang="ts">
  import { page } from '$app/stores';
  import { user, admin, dictionary, isManager } from '$lib/stores';
  import { updateOnline, getCollection, Doc } from 'sveltefirets';
  import { where, limit } from 'firebase/firestore';
  import { arrayRemove, arrayUnion, GeoPoint, type FieldValue } from 'firebase/firestore/lite';
  import { Button, ShowHide, JSON } from 'svelte-pieces';
  import EditString from '../EditString.svelte';
  import type { IDictionary } from '@living-dictionaries/types';
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte';
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte';
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte';
  import PublicCheckbox from '$lib/components/settings/PublicCheckbox.svelte'; // only used here - perhaps colocate
  import PrintAccessCheckbox from '$lib/components/settings/PrintAccessCheckbox.svelte'; // only used here - perhaps colocate
  import { glossingLanguages } from '$lib/glosses/glossing-languages';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import ImageDropZone from '$lib/components/image/ImageDropZone.svelte';

  async function updateDictionary(change: Partial<IDictionary>) {
    try {
      await updateOnline<IDictionary>(`dictionaries/${$dictionary.id}`, change)
    } catch (err) {
      alert(`${$page.data.t('misc.error')}: ${err}`);
    }
  }

  async function updateGlossLanguages(change: FieldValue) {
    await updateDictionary({ glossLanguages: change as unknown as string[] })
  }
</script>

<Doc
  path={`dictionaries/${$dictionary.id}`}
  startWith={$dictionary}
  on:data={(e) => dictionary.set(e.detail.data)} />

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.settings')}</h3>

  <EditString
    value={$dictionary.name}
    minlength={2}
    required
    id="name"
    save={async (name) => await updateDictionary({ name })}
    display={$page.data.t('settings.edit_dict_name')} />
  <div class="mb-5" />

  <EditString
    value={$dictionary.iso6393}
    id="iso6393"
    save={async (iso6393) => await updateDictionary({ iso6393 })}
    display="ISO 639-3" />
  <div class="mb-5" />

  <EditString
    value={$dictionary.glottocode}
    id="glottocode"
    save={async (glottocode) => await updateDictionary({ glottocode })}
    display="Glottocode" />
  <div class="mb-5" />

  <EditableGlossesField
    minimum={1}
    availableLanguages={glossingLanguages}
    selectedLanguages={$dictionary.glossLanguages}
    on:add={async ({detail: { languageId }}) => await updateGlossLanguages(arrayUnion(languageId))}
    on:remove={async ({detail: { languageId }}) => {
      try {
        const entriesUsingGlossLanguage = await getCollection(
          `dictionaries/${$dictionary.id}/words`,
          [where(`gl.${languageId}`, '>', ''), limit(1)]
        );
        if (entriesUsingGlossLanguage.length == 0) {
          await updateGlossLanguages(arrayRemove(languageId));
        } else if ($admin) {
          const removeGlossLanguageInUse = confirm('Remove as admin even though this glossing language is in use already? Know that regular editors get a message saying "Contact Us"')
          if (removeGlossLanguageInUse) await updateGlossLanguages(arrayRemove(languageId));
        } else {
          alert($page.data.t('header.contact_us'));
        }
      } catch (err) {
        return console.error(err);
      }
    }} />
  <div class="mb-5" />

  <EditableAlternateNames
    alternateNames={$dictionary.alternateNames}
    on:update={async ({ detail: {alternateNames}}) => await updateDictionary({ alternateNames})} />
  <div class="mb-5" />

  <WhereSpoken
    dictionary={$dictionary}
    on:updateCoordinates={async ({ detail }) => await updateDictionary({ coordinates: new GeoPoint(detail.latitude, detail.longitude)})}
    on:removeCoordinates={async () => await updateDictionary({ coordinates: null })}
    on:updatePoints={async ({ detail }) => await updateDictionary({ points: detail })}
    on:updateRegions={async ({ detail }) => await updateDictionary({ regions: detail})} />
  <div class="mb-5" />

  <EditString
    value={$dictionary.location}
    maxlength={100}
    id="location"
    save={async (location) => await updateDictionary({ location })}
    display={$page.data.t('dictionary.location')} />
  <div class="mb-5" />

  <div class="text-sm font-medium text-gray-700 mb-2">
    {$page.data.t('settings.featured_image')}
  </div>
  {#if $dictionary.featuredImage}
    <Image
      canEdit
      height={300}
      title="{$dictionary.name} Featured Image"
      gcs={$dictionary.featuredImage.specifiable_image_url}
      on:deleteImage={async () => await updateDictionary({ featuredImage: null })} />
  {:else}
    <ImageDropZone let:file class="p-3 rounded">
      <span slot="label">{$page.data.t('misc.upload')}</span>
      {#if file}
        {#await import('$lib/components/image/UploadImage.svelte') then { default: UploadImage }}
          <div class="flex flex-col min-h-100px">
            <UploadImage
              {file}
              fileLocationPrefix={`${$dictionary.id}/featured_images/`}
              on:uploaded={async ({detail: {fb_storage_path, specifiable_image_url}}) => await updateDictionary({
                featuredImage: {
                  fb_storage_path,
                  specifiable_image_url,
                  uid_added_by: $user.uid,
                  timestamp: new Date(),
                }
              })} />
          </div>
        {/await}
      {/if}
    </ImageDropZone>
  {/if}
  <div class="mb-5" />

  <PrintAccessCheckbox
    checked={$dictionary.printAccess}
    on:changed={async ({ detail: { checked } }) => await updateDictionary({ printAccess: checked })} />
  <div class="mb-5" />

  <PublicCheckbox
    checked={$dictionary.public}
    on:changed={async ({ detail: { checked } }) => {
      if (!checked) {
        await updateDictionary({ public: false });
      } else if ($admin) {
        await updateDictionary({ public: true });
      } else {
        const communityAllowsOnline = confirm($page.data.t('settings.community_permission'))
        if (communityAllowsOnline) alert($page.data.t('header.contact_us'));
      }
    }} />
  <div class="mb-5" />

  {#if $isManager}
    <div>
      <ShowHide let:show let:toggle>
        <Button onclick={toggle} class="mb-5" color="red">
          {$page.data.t('misc.delete')}:
          {$page.data.t('header.contact_us')}
        </Button>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact subject="delete_dictionary" on:close={toggle} />
          {/await}
        {/if}
      </ShowHide>
    </div>
  {/if}

  {#if $admin > 1}
    <div class="mt-5">
      <JSON obj={$dictionary} />
    </div>
  {/if}
</div>

<SeoMetaTags
  title={$page.data.t('misc.settings')}
  dictionaryName={$dictionary.name}
  description="Under Settings, dictionary managers can edit the dictionary\'s parameters such as its name, ISO 639-3 Code, Glottocode, translation languages, alternate names, geo-coordinates, and other information. They can also toggle on or off the ability to make the dictionary public, and the ability to make the dictionary printable to viewers."
  keywords="Settings, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
