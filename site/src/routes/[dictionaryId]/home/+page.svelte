<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { EntryData } from '$lib/types'
  import type { DictHomeCard } from '$lib/db/server/dict-home'
  import type { DictHomeStats } from './HomeStats.svelte'
  import type { ImageUploadStatus } from '$lib/components/image/upload-image'
  import HomeEntryCard from './HomeEntryCard.svelte'
  import HomeStats from './HomeStats.svelte'
  import MapPanel from './MapPanel.svelte'
  import DomainsPanel from './DomainsPanel.svelte'
  import NudgeCard from './NudgeCard.svelte'
  import HeroFieldModal from './HeroFieldModal.svelte'
  import HeroImageControls from './HeroImageControls.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import JsonLd from '$lib/components/JsonLd.svelte'
  import CopyButton from '$lib/components/ui/CopyButton.svelte'
  import Skeleton from '$lib/components/ui/Skeleton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte'
  import EditableOrthographies from '$lib/components/settings/EditableOrthographies.svelte'
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte'
  import { stream_resolve } from '$lib/state/stream-resolve.svelte'
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
  import { upload_cover_image } from './hero-image'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiStarOutline from '~icons/mdi/star-outline'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'

  const { data } = $props()
  const {
    dictionary,
    dict_db,
    entries_data,
    speakers,
    search_entries,
    search_index_updated,
    auth_user,
    is_manager,
    is_editor_or_above,
    update_dictionary,
  } = $derived(data)
  // Resolved on SSR/hydration; a pending streamed promise on client-nav (see the
  // server load) — skeleton strips below cover the pending gap.
  const home_data = stream_resolve(() => data.home_data)
  const ssr_featured = $derived(home_data.value?.ssr_featured ?? [])
  const ssr_recent = $derived(home_data.value?.ssr_recent ?? [])
  const partners = $derived(home_data.value?.partners ?? [])
  const home_pending = $derived(home_data.value === undefined)
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

  // ── manager in-place editing (server catalog endpoint stays manager-gated) ──
  const is_con_lang = $derived(!!dictionary.con_language_description)
  type EditingField = 'name' | 'iso' | 'glottocode' | 'location' | 'alt_names' | 'gloss_languages' | 'orthographies'
  let editing = $state<EditingField | null>(null)
  const ortho_names = $derived((Array.isArray(dictionary.orthographies) ? dictionary.orthographies : [])
    .map(orthography => orthography.name || orthography.code))

  async function save_catalog(change: Parameters<typeof update_dictionary>[0]) {
    try {
      await update_dictionary(change)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  // Same in-use safety as the settings page: only site admins may remove a
  // glossing language (it may already be used by senses).
  async function remove_gloss_language(language_id: string) {
    if (!auth_user.is_admin) {
      alert(t('header.contact_us'))
      return
    }
    if (confirm('Remove as admin even though this glossing language may be in use already? Know that regular editors get a message saying "Contact Us"'))
      await save_catalog({ gloss_languages: dictionary.gloss_languages.filter(id => id !== language_id) })
  }

  // ── cover image (hidden for con-langs, mirroring settings) ──────────────────
  const can_edit_cover = $derived(is_manager && !is_con_lang)
  let cover_upload = $state<Readable<ImageUploadStatus> | null>(null)
  function add_cover_file(file: File) {
    cover_upload = upload_cover_image({
      file,
      dictionary_id: dictionary.id,
      update_dictionary,
      on_saved: () => { cover_upload = null },
    })
  }

  let drag_depth = $state(0)
  function has_files(event: DragEvent) {
    return !!event.dataTransfer?.types.includes('Files')
  }
  function drop_cover_file(event: DragEvent) {
    event.preventDefault()
    drag_depth = 0
    const file = event.dataTransfer?.files?.[0]
    if (file)
      add_cover_file(file)
  }
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

  const dict_url = $derived(`https://livingdictionaries.app/${dictionary.url}`)
  const seo_home_description = $derived(about_snippet
    || `${dictionary.name} Living Dictionary${dictionary.location ? ` (${dictionary.location})` : ''}: a collaborative multimedia dictionary with ${dictionary.entry_count} entries — words with translations, audio from speakers, and photos.`)

  // schema.org DefinedTermSet + Language — the citable "set" that each entry's
  // DefinedTerm points back into, so AI answer engines can attribute the corpus.
  const json_ld = $derived({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': dict_url,
    'url': dict_url,
    'name': `${dictionary.name} Living Dictionary`,
    'description': seo_home_description,
    'about': {
      '@type': 'Language',
      'name': dictionary.name,
      ...dictionary.alternate_names?.length && { alternateName: dictionary.alternate_names },
      ...dictionary.iso_639_3 && { identifier: dictionary.iso_639_3 },
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Living Tongues Institute for Endangered Languages',
      'url': 'https://livingtongues.org',
    },
  })

  const show_nudges = $derived(is_editor_or_above && live_featured_ready && !$entries_loading)
  const nudge_star = $derived(show_nudges && featured_cards.length === 0)
  const nudge_location = $derived(is_manager && !has_coordinates)
  const nudge_image = $derived(can_edit_cover && !dictionary.featured_image)
  const nudge_about = $derived(is_manager && (dictionary.about?.length || 0) < MINIMUM_ABOUT_LENGTH)
  const any_nudge = $derived(nudge_star || nudge_location || nudge_image || nudge_about)
</script>

<div class="home">
  <header
    class="hero"
    class:has-image={!!dictionary.featured_image}
    ondragenter={can_edit_cover ? (event) => { if (has_files(event)) { event.preventDefault(); drag_depth += 1 } } : undefined}
    ondragover={can_edit_cover ? (event) => { if (has_files(event)) event.preventDefault() } : undefined}
    ondragleave={can_edit_cover ? () => { drag_depth = Math.max(0, drag_depth - 1) } : undefined}
    ondrop={can_edit_cover ? drop_cover_file : undefined}>
    {#if dictionary.featured_image}
      <img class="hero-image" src={image_src(dictionary.featured_image.serving_url, 'w1600')} alt={dictionary.name} />
      <div class="hero-scrim"></div>
    {/if}
    {#if can_edit_cover}
      <HeroImageControls
        has_image={!!dictionary.featured_image}
        uploading={cover_upload}
        on_file={add_cover_file}
        on_delete={async () => await save_catalog({ featured_image: null })}
        on_dismiss_error={() => { cover_upload = null }} />
      {#if drag_depth > 0}
        <div class="drop-hint">{t('dict_home.drop_cover_hint')}</div>
      {/if}
    {/if}
    <div class="hero-content">
      <h1>
        {dictionary.name}
        {#if is_manager}
          <button type="button" class="edit-btn" title={t('settings.edit_dict_name')} onclick={() => editing = 'name'}>
            <IconMdiPencilOutline class="icon-inline" />
          </button>
        {/if}
      </h1>
      <div class="hero-meta">
        {#if dictionary.location}
          {#if is_manager && !is_con_lang}
            <button type="button" class="editable" title={t('dictionary.location')} onclick={() => editing = 'location'}>
              {dictionary.location}
              <IconMdiPencilOutline class="icon-inline pencil" />
            </button>
          {:else}
            <span>{dictionary.location}</span>
          {/if}
        {:else if is_manager && !is_con_lang}
          <button type="button" class="chip add-chip" onclick={() => editing = 'location'}>+ {t('dictionary.location')}</button>
        {/if}
        {#if !is_con_lang}
          {#if dictionary.iso_639_3}
            {#if is_manager}
              <button type="button" class="chip editable" title="ISO 639-3" onclick={() => editing = 'iso'}>
                ISO 639-3: {dictionary.iso_639_3}
                <IconMdiPencilOutline class="icon-inline pencil" />
              </button>
            {:else}
              <span class="chip">ISO 639-3: {dictionary.iso_639_3}</span>
            {/if}
          {:else if is_manager}
            <button type="button" class="chip add-chip" onclick={() => editing = 'iso'}>+ ISO 639-3</button>
          {/if}
          {#if dictionary.glottocode}
            {#if is_manager}
              <button type="button" class="chip editable" title="Glottocode" onclick={() => editing = 'glottocode'}>
                {dictionary.glottocode}
                <IconMdiPencilOutline class="icon-inline pencil" />
              </button>
            {:else}
              <span class="chip">{dictionary.glottocode}</span>
            {/if}
          {:else if is_manager}
            <button type="button" class="chip add-chip" onclick={() => editing = 'glottocode'}>+ Glottocode</button>
          {/if}
        {/if}
        {#if dictionary.alternate_names?.length}
          {#if is_manager}
            <button type="button" class="editable alt-names" title={t('create.alternate_names')} onclick={() => editing = 'alt_names'}>
              {dictionary.alternate_names.join(' · ')}
              <IconMdiPencilOutline class="icon-inline pencil" />
            </button>
          {:else}
            <span class="alt-names">{dictionary.alternate_names.join(' · ')}</span>
          {/if}
        {:else if is_manager}
          <button type="button" class="chip add-chip" onclick={() => editing = 'alt_names'}>+ {t('create.alternate_names')}</button>
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
      {#if gloss_chips.length || is_manager}
        <div class="gloss-chips">
          {#each gloss_chips as chip (chip)}
            <span class="chip">{chip}</span>
          {/each}
          {#if is_manager}
            <button type="button" class="chip editable" title={t('create.gloss_dictionary_in')} onclick={() => editing = 'gloss_languages'}>
              <IconMdiPencilOutline class="icon-inline pencil" />
            </button>
          {/if}
        </div>
      {/if}
      {#if ortho_names.length || is_manager}
        <div class="gloss-chips">
          {#if ortho_names.length}
            <span class="chips-label">{t('entry_field.local_orthography')}:</span>
            {#each ortho_names as name, index (index)}
              <span class="chip">{name}</span>
            {/each}
            {#if is_manager}
              <button type="button" class="chip editable" title={t('entry_field.local_orthography')} onclick={() => editing = 'orthographies'}>
                <IconMdiPencilOutline class="icon-inline pencil" />
              </button>
            {/if}
          {:else}
            <button type="button" class="chip add-chip" onclick={() => editing = 'orthographies'}>+ {t('entry_field.local_orthography')}</button>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  {#if home_pending && !live_featured_ready}
    <!-- Client-nav while home_data streams: shimmer strip mirroring the card grid. -->
    <section>
      <Skeleton width="9rem" height="1rem" />
      <div class="strip" style="margin-top: 0.75rem">
        {#each Array.from({ length: 5 }, (_, index) => index) as index (index)}
          <Skeleton width="10.625rem" height="14rem" radius="0.75rem" />
        {/each}
      </div>
    </section>
  {/if}

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
        about_href="/{dictionary.url}/about"
        on_image_file={add_cover_file} />
    {/if}
  </div>

  {#if auth_user.admin_level >= 3 && top_domains.length}
    <DomainsPanel domains={top_domains} />
  {/if}
</div>

{#if editing === 'name'}
  <HeroFieldModal
    display={t('settings.edit_dict_name')}
    value={dictionary.name}
    minlength={2}
    maxlength={100}
    required
    save={async name => await update_dictionary({ name })}
    on_close={() => editing = null} />
{:else if editing === 'iso'}
  <HeroFieldModal
    display="ISO 639-3"
    value={dictionary.iso_639_3}
    maxlength={30}
    save={async iso_639_3 => await update_dictionary({ iso_639_3 })}
    on_close={() => editing = null} />
{:else if editing === 'glottocode'}
  <HeroFieldModal
    display="Glottocode"
    value={dictionary.glottocode}
    maxlength={30}
    save={async glottocode => await update_dictionary({ glottocode })}
    on_close={() => editing = null} />
{:else if editing === 'location'}
  <HeroFieldModal
    display={t('dictionary.location')}
    value={dictionary.location}
    maxlength={100}
    save={async location => await update_dictionary({ location })}
    on_close={() => editing = null} />
{:else if editing === 'alt_names'}
  <Modal on_close={() => editing = null}>
    <EditableAlternateNames
      alternateNames={dictionary.alternate_names}
      on_update={async new_value => await save_catalog({ alternate_names: new_value })} />
  </Modal>
{:else if editing === 'gloss_languages'}
  <Modal on_close={() => editing = null}>
    <EditableGlossesField
      minimum={1}
      availableLanguages={glossingLanguages}
      selectedLanguages={dictionary.gloss_languages}
      add_language={async language_id => await save_catalog({ gloss_languages: [...dictionary.gloss_languages, language_id] })}
      remove_language={async language_id => await remove_gloss_language(language_id)} />
  </Modal>
{:else if editing === 'orthographies'}
  <Modal on_close={() => editing = null}>
    <EditableOrthographies
      {dictionary}
      on_update={async orthographies => await save_catalog({ orthographies })} />
  </Modal>
{/if}

{#if dictionary.public}
  <JsonLd data={json_ld} />
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={t('dict_home.home')}
  dictionaryName={dictionary.name}
  gcsPath={dictionary.featured_image?.serving_url}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  description={seo_home_description} />

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.75rem 0 3rem;
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
  }

  .drop-hint {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    background: color-mix(in srgb, var(--primary) 55%, rgb(0 0 0 / 0.4));
    border: 2px dashed rgb(255 255 255 / 0.8);
    border-radius: 1rem;
    pointer-events: none;
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
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border: 1px solid transparent; /* match .add-chip's dashed border so all chips are the same height */
    border-radius: 9999px;
    font-size: 0.75rem;
    line-height: 1.5;
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  /* beats button.editable's font-size: inherit so editable chips match plain chips */
  button.chip.editable,
  button.chip.add-chip {
    font-size: 0.75rem;
  }

  .has-image .chip {
    background: rgb(255 255 255 / 0.18);
    backdrop-filter: blur(4px);
  }

  .edit-btn {
    font-size: 1rem;
    vertical-align: middle;
    opacity: 0.55;
    color: inherit;
    transition: opacity 0.15s ease;
  }

  .edit-btn:hover {
    opacity: 1;
  }

  button.editable {
    color: inherit;
    font-size: inherit;
    text-align: start;
    cursor: pointer;
  }

  button.editable :global(.pencil) {
    font-size: 0.8125em;
    opacity: 0.55;
    transition: opacity 0.15s ease;
  }

  button.editable:hover :global(.pencil) {
    opacity: 1;
  }

  button.chip.editable:hover {
    background: color-mix(in srgb, var(--color) 14%, transparent);
  }

  .has-image button.chip.editable:hover {
    background: rgb(255 255 255 / 0.3);
  }

  .add-chip {
    background: transparent;
    border: 1px dashed color-mix(in srgb, currentColor 45%, transparent);
    color: inherit;
    opacity: 0.75;
    cursor: pointer;
  }

  .add-chip:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  .has-image .add-chip:hover {
    background: rgb(255 255 255 / 0.18);
  }

  .chips-label {
    font-size: 0.75rem;
    opacity: 0.75;
    align-self: center;
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
