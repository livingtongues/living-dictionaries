<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import type { DictionaryBucket } from '$lib/constants'
  import { DICTIONARY_BUCKETS } from '$lib/constants'
  import IconMdiMapMarkerOutline from '~icons/mdi/map-marker-outline'
  import IconMdiMapMarkerPlusOutline from '~icons/mdi/map-marker-plus-outline'
  import BadgeArray from '$lib/components/entry/BadgeArray.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { format_date } from '$lib/utils/format-relative-time'
  import { api_dictionaries_id_delete } from '../../api/dictionaries/[id]/_call'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RoleCell from './RoleCell.svelte'

  interface Editor {
    role_id: string
    user_id: string
    name: string
    email: string | null
  }

  interface Props {
    index: number
    dictionary: RowType<'dictionaries'>
    managers: Editor[]
    contributors: Editor[]
    manager_invites: RowType<'invites'>[]
    contributor_invites: RowType<'invites'>[]
    users: RowType<'users'>[]
    on_change: () => Promise<void>
  }

  let {
    index,
    dictionary,
    managers,
    contributors,
    manager_invites,
    contributor_invites,
    users,
    on_change,
  }: Props = $props()

  let show_coordinates = $state(false)
  let show_delete = $state(false)
  let typed_id = $state('')
  let deleting = $state(false)

  const point = $derived(dictionary.coordinates?.points?.[0]?.coordinates)

  async function toggle_public() {
    if (!confirm(`Make "${dictionary.name}" ${dictionary.public ? 'PRIVATE' : 'PUBLIC'}?`))
      return
    dictionary.public = dictionary.public ? null : 1
    await dictionary._save()
  }

  async function set_bucket(event: Event) {
    const { value } = event.currentTarget as HTMLSelectElement
    dictionary.bucket = (value || null) as DictionaryBucket | null
    await dictionary._save()
    await on_change()
  }

  async function save_conlang_description(event: Event) {
    const next = (event.currentTarget as HTMLTextAreaElement).value.trim() || null
    if (dictionary.con_language_description === next)
      return
    dictionary.con_language_description = next
    await dictionary._save()
  }

  async function set_coordinates({ lat, lng }: { lat: number, lng: number }) {
    const [, ...rest] = dictionary.coordinates?.points ?? []
    dictionary.coordinates = {
      points: [{ coordinates: { latitude: lat, longitude: lng } }, ...rest],
      regions: dictionary.coordinates?.regions,
    }
    await dictionary._save()
  }

  async function remove_coordinates() {
    const [, ...rest] = dictionary.coordinates?.points ?? []
    dictionary.coordinates = { points: rest, regions: dictionary.coordinates?.regions }
    await dictionary._save()
  }

  async function save_alternate_names(strings: string[]) {
    dictionary.alternate_names = strings
    await dictionary._save()
  }

  async function confirm_delete() {
    deleting = true
    const { error } = await api_dictionaries_id_delete({ dict_id: dictionary.id })
    if (error) {
      deleting = false
      alert(`Could not delete dictionary: ${error.message}`)
      return
    }
    await dictionary._delete() // optimistic local removal
    await on_change()
    deleting = false
    show_delete = false
  }
</script>

<td class="index-cell">
  <a href="/{dictionary.url}" target="_blank" class="index-link">{index + 1}</a>
</td>
<td class="edit-cell"><DictionaryFieldEdit {dictionary} field="name" /></td>
<td>
  <button type="button" class={['pill-btn', dictionary.public ? 'is-public' : 'is-private']} onclick={toggle_public}>
    {dictionary.public ? 'Public' : 'Private'}
  </button>
</td>
<td>
  <select
    class={['bucket-select', dictionary.bucket ?? 'unclassified']}
    value={dictionary.bucket ?? ''}
    onchange={set_bucket}
    aria-label="Bucket">
    <option value="">unclassified</option>
    {#each DICTIONARY_BUCKETS as bucket (bucket)}
      <option value={bucket}>{bucket}</option>
    {/each}
  </select>
</td>
<td class="num-cell">
  <a href="/{dictionary.url}" target="_blank" class="entry-link">{(dictionary.entry_count ?? 0).toLocaleString()}</a>
</td>
<td>
  <RoleCell dictionary_id={dictionary.id} role="manager" editors={managers} invites={manager_invites} {users} {on_change} />
</td>
<td>
  <RoleCell dictionary_id={dictionary.id} role="contributor" editors={contributors} invites={contributor_invites} {users} {on_change} />
</td>
<td class="edit-cell"><DictionaryFieldEdit {dictionary} field="iso_639_3" /></td>
<td class="edit-cell"><DictionaryFieldEdit {dictionary} field="glottocode" /></td>
<td>
  <button type="button" class="coord-btn" onclick={() => show_coordinates = true}>
    {#if point}
      <IconMdiMapMarkerOutline />
      <span class="coord-text">{point.latitude.toFixed(3)}, {point.longitude.toFixed(3)}</span>
    {:else}
      <IconMdiMapMarkerPlusOutline />
      <span class="coord-add">Add</span>
    {/if}
  </button>
</td>
<td class="edit-cell"><DictionaryFieldEdit {dictionary} field="location" /></td>
<td class="wide-cell">
  {#if dictionary.gloss_languages?.length}
    <BadgeArray strings={dictionary.gloss_languages.slice(0, 8)} />
    {#if dictionary.gloss_languages.length > 8}
      <span class="overflow">+{dictionary.gloss_languages.length - 8}</span>
    {/if}
  {:else}
    <span class="dim">—</span>
  {/if}
</td>
<td class="wide-cell">
  <BadgeArray
    strings={dictionary.alternate_names ?? []}
    canEdit
    addMessage="Add"
    promptMessage="Enter alternate name:"
    onvalueupdated={save_alternate_names} />
</td>
<td class="wide-cell">
  {#if dictionary.orthographies?.length}
    {dictionary.orthographies.map(orthography => orthography.name).join(', ')}
  {:else}
    <span class="dim">—</span>
  {/if}
</td>
<td class="meta-cell">{format_date(dictionary.created_at)}</td>
<td class="meta-cell">{format_date(dictionary.updated_at)}</td>
<td class="center-cell">
  {typeof dictionary.language_used_by_community === 'number' ? (dictionary.language_used_by_community ? 'Yes' : 'No') : '—'}
</td>
<td class="wide-cell">{dictionary.community_permission || '—'}</td>
<td class="text-cell">
  <div class="clamp" title={dictionary.author_connection ?? ''}>{dictionary.author_connection || '—'}</div>
</td>
<td class="text-cell">
  {#if dictionary.bucket === 'conlang'}
    <textarea
      class="conlang-edit"
      rows="3"
      placeholder="Conlang description"
      value={dictionary.con_language_description ?? ''}
      onchange={save_conlang_description}></textarea>
  {:else}
    <div class="clamp locked" title="Editable only when the dictionary is bucketed as a conlang">{dictionary.con_language_description || '—'}</div>
  {/if}
</td>
<td>
  <button type="button" class="delete-btn" onclick={() => { typed_id = ''; show_delete = true }}>Delete</button>
</td>

{#if show_coordinates}
  {#await import('$lib/components/maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
    <CoordinatesModal
      lat={point?.latitude}
      lng={point?.longitude}
      on_update={coordinates => set_coordinates(coordinates)}
      on_remove={remove_coordinates}
      on_close={() => show_coordinates = false} />
  {/await}
{/if}

{#if show_delete}
  <Modal on_close={() => show_delete = false}>
    {#snippet heading()}
      Delete {dictionary.name}?
    {/snippet}
    <p class="delete-info">
      Full teardown: catalog row, roles, invites, the per-dictionary database, and its R2 snapshot.
      Media files orphan on legacy storage (queued for later cleanup). This cannot be undone.
    </p>
    <p class="delete-meta">id: <code>{dictionary.id}</code></p>
    <input
      type="text"
      bind:value={typed_id}
      placeholder="Type the dictionary id to confirm"
      class="delete-input" />
    <div class="delete-actions">
      <button type="button" class="btn btn-default" onclick={() => show_delete = false}>Cancel</button>
      <button
        type="button"
        class="btn btn-default delete-confirm"
        disabled={typed_id !== dictionary.id || deleting}
        onclick={confirm_delete}>
        {deleting ? 'Deleting…' : 'Delete forever'}
      </button>
    </div>
  </Modal>
{/if}

<style>
  td {
    padding: 0.375rem 0.5rem;
    vertical-align: top;
  }
  .index-cell {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }
  .index-link {
    font-size: 0.75rem;
    color: var(--color-secondary);
    text-decoration: none;
  }
  .index-link:hover {
    color: var(--primary);
  }
  .edit-cell {
    min-width: 8rem;
  }
  .num-cell {
    text-align: right;
    white-space: nowrap;
  }
  .entry-link {
    color: var(--primary);
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }
  .entry-link:hover {
    text-decoration: underline;
  }
  .pill-btn {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
  }
  .pill-btn.is-public {
    background: color-mix(in srgb, var(--success), transparent 85%);
    color: var(--success);
  }
  .pill-btn.is-private {
    background: color-mix(in srgb, var(--warning), transparent 85%);
    color: var(--warning);
  }
  .bucket-select {
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    cursor: pointer;
  }
  .bucket-select:focus {
    outline: none;
    border-color: var(--primary);
  }
  .bucket-select.public { color: var(--success); }
  .bucket-select.unlisted { color: var(--primary); }
  .bucket-select.conlang { color: var(--warning); }
  .bucket-select.glossary { color: color-mix(in srgb, var(--warning) 55%, var(--danger)); }
  .bucket-select.delete { color: var(--danger); }
  .bucket-select.unclassified { color: var(--color-secondary); }
  .conlang-edit {
    width: 100%;
    min-width: 12rem;
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    font-size: 0.8125rem;
    color: var(--color);
    resize: vertical;
    font-family: inherit;
  }
  .conlang-edit:focus {
    outline: none;
    border-color: var(--primary);
  }
  .clamp.locked {
    color: var(--color-secondary);
  }
  .coord-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 0;
    background: transparent;
    color: var(--color);
    cursor: pointer;
    font-size: 0.8125rem;
    white-space: nowrap;
  }
  .coord-btn:hover {
    color: var(--primary);
  }
  .coord-add {
    font-weight: 600;
  }
  .wide-cell {
    min-width: 9rem;
    max-width: 16rem;
  }
  .text-cell {
    min-width: 12rem;
    max-width: 18rem;
  }
  .clamp {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.8125rem;
  }
  .meta-cell {
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .center-cell {
    text-align: center;
    white-space: nowrap;
  }
  .overflow {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .dim {
    color: var(--color-secondary);
  }
  .delete-btn {
    padding: 0.125rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid var(--danger);
    background: transparent;
    color: var(--danger);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }
  .delete-btn:hover {
    background: var(--danger);
    color: white;
  }
  .delete-info {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin: 0 0 0.75rem;
  }
  .delete-meta {
    font-size: 0.8125rem;
    margin: 0 0 0.5rem;
  }
  .delete-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    margin-bottom: 0.75rem;
  }
  .delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .delete-confirm {
    background: var(--danger);
    color: white;
    border: 0;
  }
  .delete-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
