<script lang="ts">
  import IconMdiTranslate from '~icons/mdi/translate'
  import { get_locale_display_name } from '$lib/i18n/locales'

  interface Props {
    locales: string[]
  }

  const { locales }: Props = $props()
  const language_names = $derived(locales.map(get_locale_display_name))
</script>

<span class="translator-badge" title="Translator · {language_names.join(', ')}">
  <IconMdiTranslate />
  <span class="label">Translator</span>
  <span class="languages">{language_names.join(', ')}</span>
</span>

<style>
  .translator-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.125rem 0.4375rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .translator-badge :global(svg) {
    flex: 0 0 auto;
  }

  .label {
    flex: 0 0 auto;
  }

  .languages {
    color: color-mix(in srgb, var(--primary) 72%, var(--color));
    font-weight: 500;
    overflow-wrap: anywhere;
  }
</style>
