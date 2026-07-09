<script lang="ts">
  import type { HomepageBaked } from '$lib/components/home-v2/types'
  import type { PageData } from './$types'
  import { page } from '$app/state'
  import baked_json from '$lib/data/homepage-baked.json'
  import AgentApiDiagram from '$lib/components/home-v2/AgentApiDiagram.svelte'
  import CtaBand from '$lib/components/home-v2/CtaBand.svelte'
  import FeaturesGrid from '$lib/components/home-v2/FeaturesGrid.svelte'
  import HeroSearchBar from '$lib/components/home-v2/HeroSearchBar.svelte'
  import HeroUnit from '$lib/components/home-v2/HeroUnit.svelte'
  import StatsBand from '$lib/components/home-v2/StatsBand.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import JsonLd from '$lib/components/JsonLd.svelte'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
  const { map_dicts, ssr_map, my_dictionaries } = $derived(data)
  const t = $derived(page.data.t)
  const baked = baked_json as HomepageBaked
  // The "Turn archives into living data" block is still being iterated — admin-3 only for now.
  const show_agent_diagram = $derived((page.data.auth_user?.admin_level ?? 0) >= 3)

  // schema.org WebSite + Organization — publisher context for search + AI answer engines.
  const json_ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://livingdictionaries.app',
      'url': 'https://livingdictionaries.app',
      'name': 'Living Dictionaries',
      'description': 'Collaborative multimedia dictionaries built by communities speaking endangered and under-represented languages.',
      'publisher': { '@id': 'https://livingtongues.org' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://livingtongues.org',
      'url': 'https://livingtongues.org',
      'name': 'Living Tongues Institute for Endangered Languages',
    },
  ]
</script>

<Header />

<main>
  <section class="hero">
    <h1>{t('home_v2.headline')}</h1>
    <p class="subline">{t('home_v2.subline')}</p>
    <HeroSearchBar dicts={map_dicts} my_dictionaries={$my_dictionaries ?? []} />
  </section>

  <HeroUnit dicts={map_dicts} {ssr_map} cards={baked.featured_entries} />

  <StatsBand stats={baked.stats} />

  <FeaturesGrid />

  {#if show_agent_diagram}
    <AgentApiDiagram />
  {/if}

  <CtaBand />
</main>

<JsonLd data={json_ld} />

<SeoMetaTags
  title={page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />

<style>
  main {
    min-height: 100vh;
    /* the hero's decorative connector-line SVG uses overflow:visible and can
       paint a few px past the map edge — clip x so it never adds page scroll
       (clip, not hidden, so it doesn't turn overflow-y into a scroll box) */
    overflow-x: clip;
  }

  .hero {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 1.35rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  h1 {
    font-size: clamp(1.75rem, 4.5vw, 2.75rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 0.5625rem;
  }

  .subline {
    margin: 0 0 1.35rem;
    font-size: clamp(0.9375rem, 2vw, 1.0625rem);
    line-height: 1.55;
    color: var(--color-secondary);
  }

</style>
