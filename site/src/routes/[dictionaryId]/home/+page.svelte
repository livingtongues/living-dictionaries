<script lang="ts">
  import type { EntryData } from '$lib/types'
  import type { DictHomeCard } from '$lib/db/server/dict-home'
  import type { DictHomeStats } from './HomeStats.svelte'
  import HomeEntryCard from './HomeEntryCard.svelte'
  import HomeStats from './HomeStats.svelte'
  import MapPanel from './MapPanel.svelte'
  import DomainsPanel from './DomainsPanel.svelte'
  import NudgeCard from './NudgeCard.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import CopyButton from '$lib/components/ui/CopyButton.svelte'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { image_src } from '$lib/utils/media-url'
  import { get_headword } from '$lib/helpers/orthographies'
  import { glossingLanguages } from '$lib/glosses/glossing-languages'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'
  import { key_between } from '$lib/api/v1/fractional-index'
  import { build_citation } from '../contributors/build-citation'
  import { MINIMUM_ABOUT_LENGTH } from '$lib/constants'
  import { first_gloss, text_snippet } from './home-helpers'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiStarOutline from '~icons/mdi/star-outline'

  const { data } = $props()
  const {
    dictionary,
    ssr_featured,
    ssr_recent,
    partners,
    dict_db,
    entries_data,
    speakers,
    search_entries,
    search_index_updated,
    auth_user,
    is_manager,
    is_editor_or_above,
  } = $derived(data)
  const t = $derived(page.data.t)
  const { loading: entries_loading } = $derived(entries_data)

  interface HomeCard {
    id: string
    entry_id: string
    lexeme: string
    gloss: string | null
    photo_serving_url: string | null
    audio_storage_path: string | null
  }

  function card_from_ssr(card: DictHomeCard): HomeCard {
    return {
      id: card.id,
      entry_id: card.entry_id,
      lexeme: get_headword({ lexeme: card.lexeme, orthographies: dictionary.orthographies }).value,
      gloss: first_gloss({ glosses: card.glosses, gloss_languages: dictionary.gloss_languages }),
      photo_serving_url: card.photo_serving_url,
      audio_storage_path: card.audio_storage_path,
    }
  }

  function card_from_entry_data({ id, entry }: { id: string, entry: EntryData }): HomeCard {
    const photo = entry.senses?.flatMap(sense => sense.photos || [])[0]
    const glosses = entry.senses?.map(sense => sense.glosses).find(g => g && Object.values(g).some(Boolean))
    return {
      id,
      entry_id: entry.id,
      lexeme: get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value,
      gloss: first_gloss({ glosses, gloss_languages: dictionary.gloss_languages }),
      photo_serving_url: photo?.serving_url ?? null,
      audio_storage_path: entry.audios?.[0]?.storage_path ?? null,
    }
  }

  // ── featured entries: SSR paints first, the live dict_db takes over ─────────
  const featured_query = $derived(dict_db?.featured_entries.query({ order_by: 'sort_key' }))
  const live_featured_ready = $derived(!!featured_query && !featured_query.loading && !$entries_loading)
  const featured_cards: HomeCard[] = $derived.by(() => {
    if (live_featured_ready) {
      return featured_query.rows
        .map((row) => {
          const entry = $entries_data[row.entry_id]
          return entry ? card_from_entry_data({ id: row.id, entry }) : null
        })
        .filter(Boolean)
    }
    return ssr_featured.map(card_from_ssr)
  })
  const recent_cards: HomeCard[] = $derived(ssr_recent.map(card_from_ssr).filter(card => card.entry_id && !featured_cards.some(featured => featured.entry_id === card.entry_id)))

  // Manage (editor+): unstar + move left/right over the live rows' fractional keys.
  const can_manage = $derived(is_editor_or_above && live_featured_ready)
  function move_featured({ row_id, direction }: { row_id: string, direction: -1 | 1 }) {
    if (!featured_query || !dict_db)
      return
    const { rows } = featured_query
    const index = rows.findIndex(row => row.id === row_id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= rows.length)
      return
    const lower = direction === -1 ? (rows[target - 1]?.sort_key ?? null) : rows[target].sort_key
    const upper = direction === -1 ? rows[target].sort_key : (rows[target + 1]?.sort_key ?? null)
    void dict_db.featured_entries.update({ id: row_id, sort_key: key_between(lower, upper) })
  }

  // ── stats: pulse until the local Orama index is ready, then count up ────────
  let stats = $state<DictHomeStats | null>(null)
  let domain_counts = $state<Record<string, number>>({})
  async function load_stats({ allow_zero }: { allow_zero: boolean }) {
    try {
      const { count, facets } = await search_entries({ query_params: { page: 1, query: '' }, page_index: 0, entries_per_page: 1, dictionary_id: dictionary.id })
      if (!count && !allow_zero)
        return // index not seeded yet — the next search_index_updated pulse retries
      stats = {
        entries: count,
        with_audio: Number(facets?.has_audio?.values?.true ?? 0),
        with_photos: Number(facets?.has_image?.values?.true ?? 0),
        with_video: Number(facets?.has_video?.values?.true ?? 0),
        speakers: $speakers.length,
      }
      domain_counts = (facets?._semantic_domains?.values as Record<string, number>) ?? {}
    } catch {
    // worker not initialized yet — retried on the next pulse
    }
  }
  $effect(() => {
    if (!browser)
      return
    void $search_index_updated // pulses when the index (re)builds
    const bundle_loaded = !$entries_loading
    void load_stats({ allow_zero: bundle_loaded })
  })

  const top_domains = $derived(Object.entries(domain_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const restored = restore_spaces_periods_from_underscores(key)
      return { label: t({ dynamicKey: `sd.${restored}`, fallback: restored }), count }
    }))

  // ── hero bits ────────────────────────────────────────────────────────────────
  const gloss_chips = $derived((Array.isArray(dictionary.gloss_languages) ? dictionary.gloss_languages : [])
    .map(bcp => t({ dynamicKey: `gl.${bcp}`, fallback: glossingLanguages[bcp]?.vernacularName ?? bcp })))
  const about_snippet = $derived(text_snippet({ html: dictionary.about }))
  const grammar_snippet = $derived(text_snippet({ html: dictionary.grammar }))
  const citation = $derived(build_citation({ t, dictionary, custom_citation: dictionary.citation || undefined, partners }))
  const has_coordinates = $derived(!!dictionary.coordinates?.points?.length || !!dictionary.coordinates?.regions?.length)

  let search_query = $state('')
  function submit_search(event: SubmitEvent) {
    event.preventDefault()
    const query = search_query.trim()
    const suffix = query ? `?q=${encodeURIComponent(JSON.stringify({ page: 1, query }))}` : ''
    void goto(`/${dictionary.url}/entries${suffix}`)
  }

  const show_nudges = $derived(is_editor_or_above && live_featured_ready && !$entries_loading)
  const nudge_star = $derived(show_nudges && featured_cards.length === 0)
  const nudge_location = $derived(is_manager && !has_coordinates)
  const nudge_image = $derived(is_manager && !dictionary.featured_image)
  const nudge_about = $derived(is_manager && (dictionary.about?.length || 0) < MINIMUM_ABOUT_LENGTH)
  const any_nudge = $derived(nudge_star || nudge_location || nudge_image || nudge_about)
</script>

<div class="home">
  <header class="hero" class:has-image={!!dictionary.featured_image}>
    {#if dictionary.featured_image}
      <img class="hero-image" src={image_src(dictionary.featured_image.serving_url, 'w1600')} alt={dictionary.name} />
      <div class="hero-scrim"></div>
    {/if}
    <div class="hero-content">
      <h1>{dictionary.name}</h1>
      <div class="hero-meta">
        {#if dictionary.location}<span>{dictionary.location}</span>{/if}
        {#if !dictionary.con_language_description}
          {#if dictionary.iso_639_3}<span class="chip">ISO 639-3: {dictionary.iso_639_3}</span>{/if}
          {#if dictionary.glottocode}<span class="chip">{dictionary.glottocode}</span>{/if}
        {/if}
        {#if dictionary.alternate_names?.length}
          <span class="alt-names">{dictionary.alternate_names.join(' · ')}</span>
        {/if}
      </div>
      <form class="search" onsubmit={submit_search}>
        <IconMdiMagnify style="font-size: 1.125rem; opacity: 0.6" />
        <input
          type="search"
          bind:value={search_query}
          placeholder={t('dict_home.search_placeholder')}
          aria-label={t('dict_home.search_placeholder')} />
      </form>
      {#if gloss_chips.length}
        <div class="gloss-chips">
          {#each gloss_chips as chip (chip)}
            <span class="chip">{chip}</span>
          {/each}
        </div>
      {/if}
    </div>
  </header>

  {#if featured_cards.length || nudge_star}
    <section>
      <h2>{t('dict_home.featured_entries')}</h2>
      {#if featured_cards.length}
        <div class="strip featured-strip">
          {#each featured_cards as card, index (card.id)}
            <HomeEntryCard
              href="/{dictionary.url}/entry/{card.entry_id}"
              entry_id={card.entry_id}
              lexeme={card.lexeme}
              gloss={card.gloss}
              photo_serving_url={card.photo_serving_url}
              audio_storage_path={card.audio_storage_path}
              manage={can_manage
                ? {
                  can_move_left: index > 0,
                  can_move_right: index < featured_cards.length - 1,
                  on_move_left: () => move_featured({ row_id: card.id, direction: -1 }),
                  on_move_right: () => move_featured({ row_id: card.id, direction: 1 }),
                  on_unstar: () => void dict_db?.featured_entries.delete(card.id),
                }
                : null} />
          {/each}
        </div>
      {:else}
        <p class="featured-hint">
          <IconMdiStarOutline class="icon-inline" style="color: var(--warning)" />
          {t('dict_home.featured_hint_editor')}
        </p>
      {/if}
    </section>
  {/if}

  <HomeStats {stats} />

  {#if about_snippet || grammar_snippet || has_coordinates || is_manager}
    <div class="two-col">
      {#if about_snippet || grammar_snippet}
        <section class="panel">
          {#if about_snippet}
            <h2>{t('header.about')}</h2>
            <p>{about_snippet} <a class="read-more" href="/{dictionary.url}/about">{t('dict_home.read_more')}</a></p>
          {/if}
          {#if grammar_snippet}
            <h2>{t('dictionary.grammar')}</h2>
            <p>{grammar_snippet} <a class="read-more" href="/{dictionary.url}/grammar">{t('dict_home.read_more')}</a></p>
          {/if}
        </section>
      {/if}
      {#if has_coordinates || is_manager}
        <MapPanel {has_coordinates} {is_manager} settings_href="/{dictionary.url}/settings" />
      {/if}
    </div>
  {/if}

  {#if recent_cards.length}
    <section>
      <h2>{t('dict_home.recently_added')}</h2>
      <div class="strip recent-strip">
        {#each recent_cards as card (card.id)}
          <HomeEntryCard
            href="/{dictionary.url}/entry/{card.entry_id}"
            entry_id={card.entry_id}
            lexeme={card.lexeme}
            gloss={card.gloss}
            photo_serving_url={card.photo_serving_url}
            audio_storage_path={card.audio_storage_path} />
        {/each}
      </div>
    </section>
  {/if}

  <div class="two-col">
    <section class="panel cite">
      <h2>{t('dict_home.how_to_cite')} <CopyButton value={citation} /></h2>
      <p class="citation">{citation}</p>
    </section>
    {#if any_nudge}
      <NudgeCard
        show_star={nudge_star}
        show_location={nudge_location}
        show_image={nudge_image}
        show_about={nudge_about}
        entries_href="/{dictionary.url}/entries"
        settings_href="/{dictionary.url}/settings"
        about_href="/{dictionary.url}/about" />
    {/if}
  </div>

  {#if auth_user.admin_level >= 3 && top_domains.length}
    <DomainsPanel domains={top_domains} />
  {/if}
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={t('dict_home.home')}
  dictionaryName={dictionary.name}
  gcsPath={dictionary.featured_image?.serving_url}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  description="Explore this Living Dictionary: featured words with photos and audio, dictionary statistics, and information about the language community." />

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.75rem 0 3rem;
    max-width: 64rem;
  }

  .hero {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--surface)), var(--surface));
    padding: 2rem 1.5rem;
  }

  .hero-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.35) 55%, rgb(0 0 0 / 0.15));
  }

  .hero-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    max-width: 36rem;
  }

  .has-image .hero-content {
    color: white;
  }

  h1 {
    font-size: clamp(1.5rem, 4vw, 2.25rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.625rem;
    font-size: 0.875rem;
  }

  .has-image .hero-meta {
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  }

  .alt-names {
    opacity: 0.75;
  }

  .chip {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  .has-image .chip {
    background: rgb(255 255 255 / 0.18);
    backdrop-filter: blur(4px);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 9999px;
    background: var(--background);
    color: var(--color);
    max-width: 26rem;
  }

  .has-image .search {
    background: rgb(255 255 255 / 0.92);
    color: rgb(23 23 23);
  }

  .search input {
    flex-grow: 1;
    border: none;
    background: transparent;
    font-size: 0.9375rem;
    color: inherit;
    outline: none;
    padding: 0;
  }

  /* The pill's own background (white over a hero image even in dark mode) makes the
     global placeholder var unreadable — derive it from the pill's text color instead. */
  .search input::placeholder {
    color: color-mix(in srgb, currentColor 55%, transparent);
  }

  .gloss-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .strip {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding: 0.125rem 0.125rem 0.375rem;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .featured-hint {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 768px) {
    .two-col {
      grid-template-columns: 3fr 2fr;
    }
  }

  .panel {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }

  .panel p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--color-secondary);
  }

  .panel p:last-child {
    margin-bottom: 0;
  }

  .read-more {
    color: var(--primary);
    white-space: nowrap;
  }

  .citation {
    overflow-wrap: anywhere;
  }
</style>
