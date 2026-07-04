<script lang="ts">
  import EntryDisplay from './EntryDisplay.svelte'
  import { seo_description } from './seo_description'
  import Button from '$lib/components/ui/Button.svelte'
  import JSON from '$lib/components/ui/JSON.svelte'
  import Modal from '$lib/components/ui/LegacyModal.svelte'
  import { share } from '$lib/utils/share'
  import { get_headword } from '$lib/helpers/orthographies'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import ChangeHistory from '$lib/components/history/ChangeHistory.svelte'
  import { track } from '$lib/debug/remote-log'
  import { ENTRY_OPENED } from '$lib/debug/log-events'
  import { page } from '$app/state'
  import { dev } from '$app/environment'
  import IconMdiHistory from '~icons/mdi/history'

  const { data } = $props()
  const {
    entry_from_page,
    derived_entry,
    shallow,
    dictionary,
    auth_user,
    can_edit,
    is_editor_or_above,
    dbOperations,
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
          if (confirmation) await dbOperations.delete_entry()
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
  {dbOperations} />

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

  .entry-history-button {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    color: var(--primary);
    font-size: 1.375rem;
    vertical-align: middle;
  }
</style>

<SeoMetaTags
  norobots={!dictionary.public}
  generate_og_image
  imageTitle={headword.value}
  imageDescription={seo_description({ entry, gloss_languages: dictionary.gloss_languages, orthographies: dictionary.orthographies, t: page.data.t })}
  dictionaryName={dictionary.name}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  url="https://livingdictionaries.app/{dictionary.url}/entry/{entry.id}"
  gcsPath={entry.senses?.[0]?.photos?.[0]?.serving_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
