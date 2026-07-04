<script lang="ts">
  import { page } from '$app/state'
  import IconMdiMapMarker from '~icons/mdi/map-marker'
  import IconMdiPlus from '~icons/mdi/plus'

  interface Props {
    has_coordinates: boolean
    is_manager: boolean
    settings_href: string
  }

  const { has_coordinates, is_manager, settings_href }: Props = $props()
  const t = $derived(page.data.t)
</script>

{#if has_coordinates}
  <!-- Placeholder — the real map lands in a later iteration. -->
  <div class="map placeholder-map">
    <IconMdiMapMarker style="font-size: 1.75rem; color: var(--primary)" />
    <span>{t('dict_home.map_soon')}</span>
  </div>
{:else if is_manager}
  <a class="map add-location" href={settings_href}>
    <IconMdiPlus style="font-size: 1.5rem" />
    <span>{t('dict_home.add_location')}</span>
  </a>
{/if}

<style>
  .map {
    min-height: 11rem;
    height: 100%;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
  }

  .placeholder-map {
    background:
      radial-gradient(circle at 30% 40%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 45%),
      radial-gradient(circle at 70% 65%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 40%),
      var(--surface);
  }

  .add-location {
    border: 2px dashed var(--border-color);
    text-decoration: none;
    transition: border-color 200ms, color 200ms;
  }

  .add-location:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
</style>
