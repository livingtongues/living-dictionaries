<script lang="ts">
  import type { HomepageBaked } from '$lib/components/home-v2/types'
  import type { PageData } from './$types'
  import { page } from '$app/state'
  import baked_json from '$lib/data/homepage-baked.json'
  import AgentApiDiagram from '$lib/components/home-v2/AgentApiDiagram.svelte'
  import CtaBand from '$lib/components/home-v2/CtaBand.svelte'
  import FeaturesGrid from '$lib/components/home-v2/FeaturesGrid.svelte'
  import HeroSearch from '$lib/components/home-v2/HeroSearch.svelte'
  import HeroUnit from '$lib/components/home-v2/HeroUnit.svelte'
  import StatsBand from '$lib/components/home-v2/StatsBand.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
  const { map_dicts, ssr_map, my_dictionaries } = $derived(data)
  const t = $derived(page.data.t)
  const baked = baked_json as HomepageBaked
  // The "Turn archives into living data" block is still being iterated — admin-3 only for now.
  const show_agent_diagram = $derived((page.data.auth_user?.admin_level ?? 0) >= 3)
</script>

<Header />

<main>
  <section class="hero">
    <h1>Serving Language Communities Around the World</h1>
    <p class="subline">Collaborative, multimedia dictionaries built by communities speaking endangered and under-represented languages.</p>
    <HeroSearch dicts={map_dicts} />
    {#if $my_dictionaries?.length}
      <div class="my-dicts">
        <span class="my-dicts-label">{t('home.my_dictionaries')}:</span>
        {#each $my_dictionaries.slice(0, 5) as dictionary (dictionary.id)}
          <a class="btn btn-sm" href="/{dictionary.url ?? dictionary.id}">{dictionary.name}</a>
        {/each}
      </div>
    {/if}
  </section>

  <HeroUnit dicts={map_dicts} {ssr_map} cards={baked.featured_entries} />

  <StatsBand stats={baked.stats} />

  <FeaturesGrid />

  {#if show_agent_diagram}
    <AgentApiDiagram />
  {/if}

  <CtaBand />
</main>

<Footer />

<SeoMetaTags
  title={page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />

<style>
  main {
    min-height: 100vh;
  }

  .hero {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2.5rem 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  h1 {
    font-size: clamp(1.75rem, 4.5vw, 2.75rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 0.625rem;
  }

  .subline {
    max-width: 38rem;
    margin: 0 0 1.5rem;
    font-size: clamp(0.9375rem, 2vw, 1.0625rem);
    line-height: 1.55;
    color: var(--color-secondary);
  }

  .my-dicts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1rem;
  }

  .my-dicts-label {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

</style>
