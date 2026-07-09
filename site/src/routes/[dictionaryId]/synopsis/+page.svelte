<script lang="ts">
  import DisplayString from './DisplayString.svelte'
  import VisualMap from './VisualMap.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/state'
  import { glossingLanguages } from '$lib/glosses/glossing-languages'

  const { data } = $props()
  const { dictionary } = data
  const activeGlossingBcps = $derived(Array.isArray(dictionary.gloss_languages)
    ? dictionary.gloss_languages.map(bcp =>
      page.data.t({ dynamicKey: `gl.${bcp}`, fallback: glossingLanguages[bcp]?.vernacularName ?? bcp }),
    )
    : [])

  const { name, iso_639_3, glottocode, alternate_names, location, coordinates, featured_image } = dictionary
</script>

<div style="max-width: 700px">
  <h3 class="synopsis-heading">{page.data.t('synopsis.name')}</h3>
  {#if !dictionary.con_language_description}
    <DisplayString display="ISO 639-3" value={iso_639_3} />
    <DisplayString display="Glottocode" value={glottocode} />
  {/if}
  <DisplayString display={page.data.t('synopsis.translations')} value={activeGlossingBcps} />
  <DisplayString display="{page.data.t('create.alternate_names')}" value={alternate_names} />
  {#if !dictionary.con_language_description}
    <DisplayString display={page.data.t('dictionary.location')} value={location} />
    <VisualMap {coordinates} />
    <div style="margin-bottom: 1.25rem"></div>
    {#if featured_image}
      <div class="section-label" style="margin-bottom: 0.5rem">
        {page.data.t('settings.featured_image')}
      </div>
      <Image
        can_edit={false}
        height={300}
        title="{name} Featured Image"
        gcs={featured_image.serving_url}
        on_delete_image={null} />
    {/if}
  {/if}
  {#if !iso_639_3 && !glottocode && activeGlossingBcps?.length === 0 && !alternate_names && !location && !coordinates && !featured_image}
    <i> {page.data.t('home.no_results')} </i>
  {/if}
  <div style="margin-bottom: 1.25rem"></div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('synopsis.name')}
  dictionaryName={name}
  description="View the parameters of this Living Dictionary, such as its name, ISO 639-3 Code, Glottocode, the translation languages present within this dictionary, the alternate names for this language, the geo-coordinates for this language, and more."
  keywords="Synopsis, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />

<style>
  .synopsis-heading {
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
  }
</style>
