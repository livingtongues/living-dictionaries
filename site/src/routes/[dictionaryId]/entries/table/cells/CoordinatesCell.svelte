<script lang="ts">
  import type { EntryData } from '$lib/types'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import IconMdiMapMarker from '~icons/mdi/map-marker'
  import IconMdiMapMarkerPlus from '~icons/mdi/map-marker-plus'

  interface Props {
    entry: EntryData
    can_edit?: boolean
  }

  const { entry, can_edit = false }: Props = $props()

  const has_coordinates = $derived(
    !!(entry.main.coordinates?.points?.length || entry.main.coordinates?.regions?.length),
  )
</script>

{#if has_coordinates || can_edit}
  <ShowHide>
    {#snippet children({ show, set, toggle })}
      <button
        type="button"
        class="pin"
        class:has-coordinates={has_coordinates}
        class:empty-affordance={!has_coordinates}
        disabled={!can_edit}
        title={page.data.t('entry_field.coordinates')}
        onclick={() => set(can_edit)}>
        {#if has_coordinates}
          <IconMdiMapMarker style="font-size: 1.125rem" />
        {:else}
          <IconMdiMapMarkerPlus style="font-size: 1.125rem" />
        {/if}
      </button>
      {#if show}
        {#await import('../../../entry/[entryId]/GeoTaggingModal.svelte') then { default: GeoTaggingModal }}
          <GeoTaggingModal
            coordinates={entry.main.coordinates}
            initial_center={page.data.dictionary?.coordinates?.points?.[0]?.coordinates}
            on_close={toggle}
            on_update={async (new_value) => {
              entry.main.coordinates = new_value
              await page.data.dict_db?.entries.update({ id: entry.id, coordinates: new_value })
            }} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
{/if}

<style>
  .pin {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    cursor: pointer;
  }

  .pin:disabled {
    cursor: default;
    opacity: 1; /* read-only pin is informational, not "disabled-looking" */
  }

  .pin.has-coordinates {
    color: var(--primary);
  }
</style>
