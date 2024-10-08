<script lang="ts">
  import { Button, JSON, ShowHide } from 'svelte-pieces'
  import EditString from '../EditString.svelte'
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
  import { MINIMUM_ABOUT_LENGTH } from '$lib/constants'

  export let data
  $: ({ dictionary, admin, is_manager, updateDictionary, add_gloss_language, remove_gloss_language, add_featured_image, about_content } = data)
</script>

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.settings')}</h3>

  <EditString
    value={$dictionary.name}
    minlength={2}
    required
    id="name"
    save={async name => await updateDictionary({ name })}
    display={$page.data.t('settings.edit_dict_name')} />
  <div class="mb-5" />

  <EditString
    value={$dictionary.iso6393}
    id="iso6393"
    save={async iso6393 => await updateDictionary({ iso6393 })}
    display="ISO 639-3" />
  <div class="mb-5" />

  <EditString
    value={$dictionary.glottocode}
    id="glottocode"
    save={async glottocode => await updateDictionary({ glottocode })}
    display="Glottocode" />
  <div class="mb-5" />

  <EditableGlossesField
    minimum={1}
    availableLanguages={glossingLanguages}
    selectedLanguages={$dictionary.glossLanguages}
    add_language={async languageId => await add_gloss_language(languageId)}
    remove_language={async languageId => await remove_gloss_language(languageId)} />
  <div class="mb-5" />

  <EditableAlternateNames
    alternateNames={$dictionary.alternateNames}
    on_update={async new_value => await updateDictionary({ alternateNames: new_value })} />
  <div class="mb-5" />

  <WhereSpoken
    dictionary={$dictionary}
    on_update_coordinates={async coordinates => await updateDictionary({ coordinates })}
    on_remove_coordinates={async () => await updateDictionary({ coordinates: null })}
    on_update_points={async points => await updateDictionary({ points })}
    on_update_regions={async regions => await updateDictionary({ regions })} />
  <div class="mb-5" />

  <EditString
    value={$dictionary.location}
    maxlength={100}
    id="location"
    save={async location => await updateDictionary({ location })}
    display={$page.data.t('dictionary.location')} />
  <div class="mb-5" />

  <div class="text-sm font-medium text-gray-700 mb-2">
    {$page.data.t('settings.featured_image')}
  </div>
  {#if $dictionary.featuredImage}
    <Image
      can_edit
      height={300}
      title="{$dictionary.name} Featured Image"
      gcs={$dictionary.featuredImage.specifiable_image_url}
      on_delete_image={async () => await updateDictionary({ featuredImage: null })} />
  {:else}
    <div class="hover:bg-gray-100 min-h-150px flex flex-col">
      <AddImage border upload_image={add_featured_image} />
    </div>
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
        await updateDictionary({ public: false })
      } else if ($admin) {
        await updateDictionary({ public: true })
      } else if (!$about_content || $about_content.about?.length < MINIMUM_ABOUT_LENGTH) {
        alert($page.data.t('about.message'))
        goto(`/${$dictionary.id}/about`)
      } else {
        const communityAllowsOnline = confirm($page.data.t('settings.community_permission'))
        if (communityAllowsOnline) alert($page.data.t('header.contact_us'))
      }
    }} />
  <div class="mb-5" />

  {#if $is_manager}
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
