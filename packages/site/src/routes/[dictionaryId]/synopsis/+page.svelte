<script lang="ts">
  import DisplayString from './DisplayString.svelte'
  import VisualMap from './VisualMap.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/state'
  import { glossingLanguages } from '$lib/glosses/glossing-languages'

  let { data } = $props();
  const { dictionary } = data
  let activeGlossingBcps = $derived(Array.isArray(dictionary.gloss_languages)
    ? dictionary.gloss_languages.map(bcp =>
      page.data.t({ dynamicKey: `gl.${bcp}`, fallback: glossingLanguages[bcp].vernacularName }),
    )
    : [])

  const { name, iso_639_3, glottocode, alternate_names, location, coordinates, featured_image } = dictionary
</script>

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">{page.data.t('synopsis.name')}</h3>
  {#if !dictionary.con_language_description}
    <DisplayString display="ISO 639-3" value={iso_639_3} />
    <DisplayString display="Glottocode" value={glottocode} />
  {/if}
  <DisplayString display={page.data.t('synopsis.translations')} value={activeGlossingBcps} />
  <DisplayString display="{page.data.t('create.alternate_names')}" value={alternate_names} />
  {#if !dictionary.con_language_description}
    <DisplayString display={page.data.t('dictionary.location')} value={location} />
    <VisualMap {coordinates} />
    <div class="mb-5"></div>
    {#if featured_image}
      <div class="text-sm font-medium text-gray-700 mb-2">
        {page.data.t('settings.featured_image')}
      </div>
      <Image
        can_edit={false}
        height={300}
        title="{name} Featured Image"
        gcs={featured_image.specifiable_image_url}
        on_delete_image={null} />
    {/if}
  {/if}
  {#if !iso_639_3 && !glottocode && activeGlossingBcps?.length === 0 && !alternate_names && !location && !coordinates && !featured_image}
    <i> {page.data.t('home.no_results')} </i>
  {/if}
  <div class="mb-5"></div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('synopsis.name')}
  dictionaryName={name}
  description="View the parameters of this Living Dictionary, such as its name, ISO 639-3 Code, Glottocode, the translation languages present within this dictionary, the alternate names for this language, the geo-coordinates for this language, and more."
  keywords="Synopsis, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
