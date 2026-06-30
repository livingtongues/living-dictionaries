<script lang="ts">
  import EditString from '../EditString.svelte'
  import { Button, JSON, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte'
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte'
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte'
  import PublicCheckbox from '$lib/components/settings/PublicCheckbox.svelte' // only used here - perhaps colocate
  import PrintAccessCheckbox from '$lib/components/settings/PrintAccessCheckbox.svelte' // only used here - perhaps colocate
  import { glossingLanguages } from '$lib/glosses/glossing-languages'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import AddImage from '$lib/components/image/AddImage.svelte'
  import { goto } from '$app/navigation'

  const { data } = $props()
  const { dictionary, auth_user, is_manager, updateDictionary, remove_gloss_language, add_featured_image, about_is_too_short } = $derived(data)

</script>

<div style="max-width: 700px">
  <h3 class="settings-heading">{$page.data.t('misc.settings')}</h3>

  <EditString
    value={dictionary.name}
    minlength={2}
    maxlength={100}
    required
    id="name"
    save={async name => await updateDictionary({ name })}
    display={$page.data.t('settings.edit_dict_name')} />
  <div style="margin-bottom: 1.25rem"></div>

  {#if !dictionary.con_language_description}
    <EditString
      value={dictionary.iso_639_3}
      id="iso6393"
      save={async iso_639_3 => await updateDictionary({ iso_639_3 })}
      display="ISO 639-3" />
    <div style="margin-bottom: 1.25rem"></div>

    <EditString
      value={dictionary.glottocode}
      id="glottocode"
      save={async glottocode => await updateDictionary({ glottocode })}
      display="Glottocode" />
    <div style="margin-bottom: 1.25rem"></div>
  {/if}

  <EditableGlossesField
    minimum={1}
    availableLanguages={glossingLanguages}
    selectedLanguages={dictionary.gloss_languages}
    add_language={async languageId => await updateDictionary({ gloss_languages: [...dictionary.gloss_languages, languageId] })}
    remove_language={async languageId => await remove_gloss_language(languageId)} />
  <div style="margin-bottom: 1.25rem"></div>

  <EditableAlternateNames
    alternateNames={dictionary.alternate_names}
    on_update={async new_value => await updateDictionary({ alternate_names: new_value })} />
  <div style="margin-bottom: 1.25rem"></div>

  {#if !dictionary.con_language_description}
    <WhereSpoken
      {dictionary}
      on_update_points={async points => await updateDictionary({ coordinates: {
        points,
        regions: dictionary.coordinates?.regions,
      } })}
      on_update_regions={async regions => await updateDictionary({ coordinates: {
        points: dictionary.coordinates?.points,
        regions,
      } })} />
    <div style="margin-bottom: 1.25rem"></div>

    <EditString
      value={dictionary.location}
      maxlength={100}
      id="location"
      save={async location => await updateDictionary({ location })}
      display={$page.data.t('dictionary.location')} />
    <div style="margin-bottom: 1.25rem"></div>

    <div class="section-label">
      {$page.data.t('settings.featured_image')}
    </div>
    {#if dictionary.featured_image}
      <Image
        can_edit
        height={300}
        title="{dictionary.name} Featured Image"
        gcs={dictionary.featured_image.serving_url}
        on_delete_image={async () => await updateDictionary({ featured_image: null })} />
    {:else}
      <div class="image-tile">
        <AddImage border upload_image={add_featured_image} />
      </div>
    {/if}
    <div style="margin-bottom: 1.25rem"></div>
  {/if}

  <PrintAccessCheckbox
    checked={!!dictionary.print_access}
    on:changed={async ({ detail: { checked } }) => await updateDictionary({ print_access: checked ? 1 : 0 })} />
  <div style="margin-bottom: 1.25rem"></div>

  {#if !dictionary.con_language_description}
    <PublicCheckbox
      checked={!!dictionary.public}
      on:changed={async ({ detail: { checked } }) => {
        if (!checked) {
          await updateDictionary({ public: 0 })
        } else if (auth_user.is_admin) {
          await updateDictionary({ public: 1 })
          dictionary.public = 1
        } else if (about_is_too_short()) {
          alert($page.data.t('about.message'))
          goto(`/${dictionary.id}/about`)
        } else {
          const communityAllowsOnline = confirm($page.data.t('settings.community_permission'))
          if (communityAllowsOnline) alert($page.data.t('header.contact_us'))
        }
        dictionary.public = 0
      }} />
    <div style="margin-bottom: 1.25rem"></div>
  {/if}

  {#if is_manager}
    <hr class="settings-divider" />

    <div>
      <ShowHide>
        {#snippet children({ show, toggle })}
          <Button onclick={toggle} class="delete-dict-button" color="red">
            {$page.data.t('settings.delete_dictionary')}:
            {$page.data.t('header.contact_us')}
          </Button>
          {#if show}
            {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
              <Contact subject="delete_dictionary" on:close={toggle} />
            {/await}
          {/if}
        {/snippet}
      </ShowHide>
    </div>
  {/if}

  {#if auth_user.admin_level > 1}
    <div style="margin-top: 1.25rem">
      <JSON obj={dictionary} />
    </div>
  {/if}
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={$page.data.t('misc.settings')}
  dictionaryName={dictionary.name}
  description="Under Settings, dictionary managers can edit the dictionary\'s parameters such as its name, ISO 639-3 Code, Glottocode, translation languages, alternate names, geo-coordinates, and other information. They can also toggle on or off the ability to make the dictionary public, and the ability to make the dictionary printable to viewers."
  keywords="Settings, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />

<style>
  .settings-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .section-label {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.5rem;
  }

  .image-tile {
    min-height: 150px;
    display: flex;
    flex-direction: column;
  }

  .image-tile:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  :global(.delete-dict-button) {
    margin-bottom: 1.25rem;
  }

  .settings-divider {
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    margin: 1.5rem 0;
  }
</style>
