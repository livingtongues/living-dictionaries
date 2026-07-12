<script lang="ts">
  import { page } from '$app/state'
  import IconMdiStarOutline from '~icons/mdi/star-outline'
  import IconMdiMapMarkerPlus from '~icons/mdi/map-marker-plus'
  import IconMdiImagePlus from '~icons/mdi/image-plus'
  import IconMdiTextBoxPlus from '~icons/mdi/text-box-plus-outline'

  interface Props {
    show_star: boolean
    show_location: boolean
    show_image: boolean
    show_about: boolean
    entries_href: string
    about_href: string
    on_location_click: () => void
    on_image_file: (file: File) => void
  }

  const { show_star, show_location, show_image, show_about, entries_href, about_href, on_location_click, on_image_file }: Props = $props()
  const t = $derived(page.data.t)
</script>

<section class="nudge">
  <h2>{t('dict_home.nudge_heading')}</h2>
  <ul>
    {#if show_star}
      <li><IconMdiStarOutline /> <a href={entries_href}>{t('dict_home.nudge_star')}</a></li>
    {/if}
    {#if show_location}
      <li><IconMdiMapMarkerPlus /> <button type="button" class="nudge-action" onclick={on_location_click}>{t('dict_home.nudge_location')}</button></li>
    {/if}
    {#if show_image}
      <li>
        <IconMdiImagePlus />
        <label class="file-nudge">
          <input
            type="file"
            accept="image/*"
            style="display: none"
            oninput={(event) => {
              const input = event.target as HTMLInputElement
              const file = input.files?.[0]
              if (file) on_image_file(file)
              input.value = ''
            }} />
          {t('dict_home.nudge_image')}
        </label>
      </li>
    {/if}
    {#if show_about}
      <li><IconMdiTextBoxPlus /> <a href={about_href}>{t('dict_home.nudge_about')}</a></li>
    {/if}
  </ul>
</section>

<style>
  .nudge {
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }

  h2 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.875rem;
  }

  li :global(svg) {
    color: var(--primary);
    margin-inline-end: 0.25rem;
  }

  a {
    color: inherit;
  }

  a:hover,
  .nudge-action:hover,
  .file-nudge:hover {
    text-decoration: underline;
    color: var(--primary);
  }

  .nudge-action {
    padding: 0;
    font-size: inherit;
    color: inherit;
  }

  .file-nudge {
    cursor: pointer;
  }
</style>
