<script lang="ts">
  import type { Coordinates } from '$lib/types'
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import EditString from '../EditString.svelte'
  import GeoTaggingModal from '../entry/[entryId]/GeoTaggingModal.svelte'
  import IconMdiPencil from '~icons/mdi/pencil'
  import IconMdiMapMarkerPath from '~icons/mdi/map-marker-path'
  import IconMdiDeleteOutline from '~icons/mdi/delete-outline'

  const { dialects, dict_db, can_edit, dictionary } = $derived(page.data)
  const initial_center = $derived(dictionary.coordinates?.points?.[0]?.coordinates)

  function geometry_count(coordinates: Coordinates | null | undefined): number {
    return (coordinates?.points?.length ?? 0) + (coordinates?.regions?.length ?? 0)
  }

  async function rename(id: string, name: Record<string, string> | null, value: string) {
    if (!value) return
    await dict_db?.dialects.update({ id, name: { ...(name || {}), default: value } })
  }

  async function remove(id: string) {
    if (!confirm(page.data.t('settings.delete_dialect_confirm')))
      return
    await dict_db?.dialects.delete(id)
  }
</script>

<div>
  <h4 class="section-heading">{page.data.t('settings.dialects_heading')}</h4>
  <p class="section-meaning">{page.data.t('settings.dialects_meaning')}</p>

  {#if !$dialects.length}
    <p class="empty">{page.data.t('settings.no_dialects')}</p>
  {:else}
    <ul class="dialect-list">
      {#each $dialects as dialect (dialect.id)}
        {@const count = geometry_count(dialect.coordinates)}
        <li class="dialect-row">
          <span class="dialect-name">{dialect.name?.default || dialect.id}</span>

          <div class="dialect-actions">
            {#if can_edit}
              <ShowHide>
                {#snippet children({ show: geo_open, toggle: toggle_geo })}
                  <HeadlessButton class="btn-ghost btn-sm" onclick={toggle_geo} title={page.data.t('settings.edit_dialect_area')}>
                    <IconMdiMapMarkerPath style="margin-right: 0.25rem; margin-top: -2px;" />
                    {page.data.t('settings.edit_dialect_area')}{count ? ` (${count})` : ''}
                  </HeadlessButton>
                  {#if geo_open}
                    <GeoTaggingModal
                      coordinates={dialect.coordinates}
                      initialCenter={initial_center}
                      on_close={toggle_geo}
                      on_update={async new_value => await dict_db?.dialects.update({ id: dialect.id, coordinates: new_value })} />
                  {/if}
                {/snippet}
              </ShowHide>

              <ShowHide>
                {#snippet children({ show: rename_open, toggle: toggle_rename })}
                  <HeadlessButton class="btn-ghost btn-sm" onclick={toggle_rename} title={page.data.t('misc.edit')}>
                    <IconMdiPencil />
                  </HeadlessButton>
                  {#if rename_open}
                    <div class="rename-row">
                      <EditString
                        id="dialect-name-{dialect.id}"
                        display={page.data.t('entry_field.dialects')}
                        value={dialect.name?.default || ''}
                        maxlength={60}
                        required
                        save={async (value) => {
                          await rename(dialect.id, dialect.name, value)
                          toggle_rename()
                        }} />
                    </div>
                  {/if}
                {/snippet}
              </ShowHide>

              <HeadlessButton class="btn-ghost btn-sm delete-btn" onclick={() => remove(dialect.id)} title={page.data.t('misc.delete')}>
                <IconMdiDeleteOutline />
              </HeadlessButton>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .section-heading {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .section-meaning {
    font-size: 0.875rem;
    color: color-mix(in srgb, var(--color) 65%, var(--background));
    margin-bottom: 0.75rem;
  }

  .empty {
    font-size: 0.875rem;
    color: color-mix(in srgb, var(--color) 55%, var(--background));
  }

  .dialect-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    border-radius: 0.5rem;
  }

  .dialect-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .dialect-row + .dialect-row {
    border-top: 1px solid color-mix(in srgb, var(--color) 8%, var(--background));
  }

  .dialect-name {
    font-weight: 500;
  }

  .dialect-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .rename-row {
    flex-basis: 100%;
    margin-top: 0.5rem;
  }

  :global(.delete-btn:hover) {
    color: var(--color-red-600, #dc2626);
  }
</style>
