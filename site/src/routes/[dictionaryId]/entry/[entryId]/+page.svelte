<script lang="ts">
  import EntryDisplay from './EntryDisplay.svelte'
  import { seo_description } from './seo_description'
  import Button from '$lib/components/ui/Button.svelte'
  import JSON from '$lib/components/ui/JSON.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { share } from '$lib/utils/share'
  import { get_headword } from '$lib/helpers/orthographies'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import JsonLd from '$lib/components/JsonLd.svelte'
  import ChangeHistory from '$lib/components/history/ChangeHistory.svelte'
  import { track } from '$lib/debug/remote-log'
  import { ENTRY_FEATURED, ENTRY_OPENED, ENTRY_UNFEATURED } from '$lib/debug/log-events'
  import { page } from '$app/state'
  import { dev } from '$app/environment'
  import { key_between } from '$lib/api/v1/fractional-index'
  import IconMdiHistory from '~icons/mdi/history'
  import IconMdiStar from '~icons/mdi/star'
  import IconMdiStarOutline from '~icons/mdi/star-outline'

  const { data } = $props()
  const {
    entry_from_page,
    derived_entry,
    shallow,
    dictionary,
    auth_user,
    can_edit,
    is_editor_or_above,
    db_operations,
    dict_db,
  } = $derived(data)

  let show_history = $state(false)

  // One `entry_opened` per entry viewed (re-fires on navigation to another entry).
  let last_opened_entry_id = ''
  $effect(() => {
    const entry_id = page.params.entryId
    if (entry_id && entry_id !== last_opened_entry_id) {
      last_opened_entry_id = entry_id
      track({ event: ENTRY_OPENED, props: { dictionary_id: dictionary.id, entry_id } })
    }
  })

  // Prefer the live read-model row (reactive to edits + sync) once the bundle
  // has loaded it; until then fall back to the SSR/cold-fetched entry so a
  // shared link paints real content immediately.
  const entry = $derived($derived_entry ?? entry_from_page)
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))

  // Featured-entry star (editor+): a `featured_entries` row = starred. Rows sync
  // like any other dict content and feed the dictionary home's featured strip.
  // The live `.rows` accessor spins up a tracking `$effect` on read, so it MUST
  // be read inside an effect — NOT a `$derived`. A `$derived` here recomputed on
  // every entry edit (it depends on the live `entry`), churning fresh effects
  // each keystroke → `effect_update_depth_exceeded` (2026-07-04 review). Reading
  // in an `$effect` and exposing a plain `$state` id keeps the accessor in its
  // designed context. (This is also the bare-rows read that exposed the
  // lazily-created-store freeze — see .issues/dict-table-accessor-rows-reactivity.md.)
  //
  // CRITICAL: depend on the STABLE route param `page.params.entryId`, NOT the
  // live `entry` object. `entry` is `$derived($derived_entry ?? …)` and re-emits
  // a fresh object on every entry-field edit AND on the initial live-row swap-in,
  // so reading `entry.id` here re-ran this effect on each of those — and each
  // re-run re-invokes `.rows` → `#track()` spins up ANOTHER nested tracking
  // effect, subscriber inc/dec churn compounding into `effect_update_depth_exceeded`.
  // The 2026-07-04 `$derived`→`$effect` move cut it 92% but left this live-`entry`
  // dependency, which is why it recurred on `/…/entry/*` (2026-07-05 review, LD2).
  // The route param only changes on real navigation, so the effect now re-runs
  // exactly when the viewed entry actually changes.
  let star_row_id = $state<string | undefined>(undefined)
  $effect(() => {
    const entry_id = page.params.entryId
    star_row_id = dict_db?.featured_entries.rows.find(row => row.entry_id === entry_id)?.id
  })
  // In-flight guard + optimistic `star_row_id` from the insert's returned row:
  // the `$effect` above only refreshes after the insert → live-rows round-trip,
  // so a rapid second click used to re-insert the same entry_id and trip the
  // UNIQUE natural key (2026-07-10 review, 🟡 P3).
  let star_in_flight = false
  async function toggle_star() {
    if (!dict_db || star_in_flight)
      return
    star_in_flight = true
    try {
      if (star_row_id) {
        const unstarred_row_id = star_row_id
        star_row_id = undefined
        await dict_db.featured_entries.delete(unstarred_row_id)
        track({ event: ENTRY_UNFEATURED, props: { dictionary_id: dictionary.id, entry_id: entry.id } })
        return
      }
      const [last] = await dict_db.featured_entries.query({ order_by: 'sort_key DESC', limit: 1 }).snapshot()
      const [inserted] = await dict_db.featured_entries.insert({ entry_id: entry.id, sort_key: key_between(last?.sort_key ?? null, null) })
      star_row_id = inserted?.id
      track({ event: ENTRY_FEATURED, props: { dictionary_id: dictionary.id, entry_id: entry.id } })
    } finally {
      star_in_flight = false
    }
  }

  const entry_description = $derived(seo_description({ entry, gloss_languages: dictionary.gloss_languages, orthographies: dictionary.orthographies, t: page.data.t }))
  const entry_url = $derived(`https://livingdictionaries.app/${dictionary.url}/entry/${entry.id}`)

  // schema.org DefinedTerm — lets search + AI answer engines parse the entry as data.
  const json_ld = $derived({
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': entry_url,
    'url': entry_url,
    'name': headword.value,
    ...entry_description && { description: entry_description },
    ...dictionary.iso_639_3 && { inLanguage: dictionary.iso_639_3 },
    ...entry.senses?.[0]?.photos?.[0]?.serving_url && { image: entry.senses[0].photos[0].serving_url },
    'inDefinedTermSet': {
      '@type': 'DefinedTermSet',
      '@id': `https://livingdictionaries.app/${dictionary.url}`,
      'name': `${dictionary.name} Living Dictionary`,
    },
  })
</script>

<div
  class:padded={!shallow}
  class:raised={shallow}
  class="action-bar">
  <Button
    class="entry-back-button"
    color="black"
    form="simple"
    onclick={() => {
      if (history.length > 1) {
        history.back()
      } else {
        window.location.href = `/${dictionary.url}/entries`
      }
    }}>
    <i class="fas fa-arrow-left rtl-x-flip"></i>
    {page.data.t('misc.back')}
  </Button>

  <div>
    {#if dev || auth_user.admin_level >= 3}
      <JSON obj={entry} />
    {/if}
    {#if can_edit}
      <Button
        color="red"
        form="simple"
        onclick={async () => {
          const confirmation = confirm(page.data.t('entry.delete_entry'))
          if (confirmation) await db_operations.delete_entry()
          history.back()
        }}>

        <span class="delete-label">
          {page.data.t('misc.delete')}
        </span>
        <i class="fas fa-trash icon-gap"></i>
      </Button>
    {/if}
    {#if !shallow}
      <Button class="entry-share-button" form="simple" onclick={() => share(dictionary.url, entry)}>
        <span>{page.data.t('misc.share')}</span>
        <div style="width: 0.5rem"></div>
        <i class="fas fa-share-square rtl-x-flip"></i>
      </Button>
    {/if}
    {#if is_editor_or_above && dict_db}
      <button
        type="button"
        class="btn-ghost entry-star-button"
        class:starred={!!star_row_id}
        title={page.data.t(star_row_id ? 'dict_home.unfeature_entry' : 'dict_home.feature_entry')}
        aria-label={page.data.t(star_row_id ? 'dict_home.unfeature_entry' : 'dict_home.feature_entry')}
        onclick={toggle_star}>
        {#if star_row_id}<IconMdiStar />{:else}<IconMdiStarOutline />{/if}
      </button>
    {/if}
    {#if is_editor_or_above}
      <button
        type="button"
        class="btn-ghost entry-history-button"
        title={page.data.t('history.history')}
        aria-label={page.data.t('history.history')}
        onclick={() => (show_history = true)}>
        <IconMdiHistory />
      </button>
    {/if}
  </div>
</div>

{#if show_history}
  <Modal class="entry-history-modal" on_close={() => (show_history = false)}>
    {#snippet heading()}History{/snippet}
    <ChangeHistory
      dictionary_id={dictionary.id}
      owner_type="entry"
      owner_id={entry.id}
      empty_label="No changes recorded for this entry yet." />
  </Modal>
{/if}

<EntryDisplay
  {entry}
  {dictionary}
  can_edit={can_edit}
  {db_operations} />

<style>
  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 30;
    background-color: var(--background);
  }

  .padded {
    padding-top: 0.25rem;
  }

  .raised {
    top: -1.5rem; /* was !-top-6 — pulls the bar up inside the entry overlay modal */
  }

  .action-bar :global(.entry-back-button) {
    padding-left: 0.5rem !important;
    padding-right: 0.5rem !important;
  }

  .delete-label {
    display: none;
  }

  @media (min-width: 768px) {
    .delete-label {
      display: inline;
    }
  }

  .icon-gap {
    margin-left: 0.25rem;
  }

  .action-bar :global(.entry-share-button) {
    display: inline-flex !important;
    align-items: center;
  }

  .entry-history-button,
  .entry-star-button {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    color: var(--primary);
    font-size: 1.375rem;
    vertical-align: middle;
  }

  .entry-star-button {
    color: var(--color-secondary);
  }

  .entry-star-button.starred {
    color: var(--warning);
  }
</style>

{#if dictionary.public}
  <JsonLd data={json_ld} />
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  generate_og_image
  imageTitle={headword.value}
  imageDescription={entry_description}
  dictionaryName={dictionary.name}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  url="https://livingdictionaries.app/{dictionary.url}/entry/{entry.id}"
  gcsPath={entry.senses?.[0]?.photos?.[0]?.serving_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
