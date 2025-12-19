<script lang="ts">
  import { Button, JSON, ShowHide } from '$lib/svelte-pieces'
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

  let { data } = $props();
  let { dictionary, admin, is_manager, updateDictionary, remove_gloss_language, add_featured_image, about_is_too_short } = $derived(data)

</script>

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.settings')}</h3>

  <EditString
    value={dictionary.name}
    minlength={2}
    maxlength={100}
    required
    id="name"
    save={async name => await updateDictionary({ name })}
    display={$page.data.t('settings.edit_dict_name')} />
  <div class="mb-5"></div>

  {#if !dictionary.con_language_description}
    <EditString
      value={dictionary.iso_639_3}
      id="iso6393"
      save={async iso_639_3 => await updateDictionary({ iso_639_3 })}
      display="ISO 639-3" />
    <div class="mb-5"></div>

    <EditString
      value={dictionary.glottocode}
      id="glottocode"
      save={async glottocode => await updateDictionary({ glottocode })}
      display="Glottocode" />
    <div class="mb-5"></div>
  {/if}

  <EditableGlossesField
    minimum={1}
    availableLanguages={glossingLanguages}
    selectedLanguages={dictionary.gloss_languages}
    add_language={async languageId => await updateDictionary({ gloss_languages: [...dictionary.gloss_languages, languageId] })}
    remove_language={async languageId => await remove_gloss_language(languageId)} />
  <div class="mb-5"></div>

  <EditableAlternateNames
    alternateNames={dictionary.alternate_names}
    on_update={async new_value => await updateDictionary({ alternate_names: new_value })} />
  <div class="mb-5"></div>

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
    <div class="mb-5"></div>

    <EditString
      value={dictionary.location}
      maxlength={100}
      id="location"
      save={async location => await updateDictionary({ location })}
      display={$page.data.t('dictionary.location')} />
    <div class="mb-5"></div>

    <div class="text-sm font-medium text-gray-700 mb-2">
      {$page.data.t('settings.featured_image')}
    </div>
    {#if dictionary.featured_image}
      <Image
        can_edit
        height={300}
        title="{dictionary.name} Featured Image"
        gcs={dictionary.featured_image.specifiable_image_url}
        on_delete_image={async () => await updateDictionary({ featured_image: null })} />
    {:else}
      <div class="hover:bg-gray-100 min-h-150px flex flex-col">
        <AddImage border upload_image={add_featured_image} />
      </div>
    {/if}
    <div class="mb-5"></div>
  {/if}

  <PrintAccessCheckbox
    checked={dictionary.print_access}
    on_changed={async ({ checked }) => await updateDictionary({ print_access: checked })} />
  <div class="mb-5"></div>

  {#if !dictionary.con_language_description}
    <PublicCheckbox
      checked={dictionary.public}
      on_changed={async ({ checked }) => {
        if (!checked) {
          await updateDictionary({ public: false })
        } else if ($admin) {
          await updateDictionary({ public: true })
          dictionary.public = true
        } else if (about_is_too_short()) {
          alert($page.data.t('about.message'))
          goto(`/${dictionary.id}/about`)
        } else {
          const communityAllowsOnline = confirm($page.data.t('settings.community_permission'))
          if (communityAllowsOnline) alert($page.data.t('header.contact_us'))
        }
        dictionary.public = false
      }} />
    <div class="mb-5"></div>
  {/if}

  {#if $is_manager}
    <div>
      <ShowHide  >
        {#snippet children({ show, toggle })}
                <Button onclick={toggle} class="mb-5" color="red">
            {$page.data.t('misc.delete')}:
            {$page.data.t('header.contact_us')}
          </Button>
          {#if show}
            {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
              <Contact subject="delete_dictionary" on_close={toggle} />
            {/await}
          {/if}
                      {/snippet}
            </ShowHide>
    </div>
  {/if}

  {#if $admin > 1}
    <div class="mt-5">
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
