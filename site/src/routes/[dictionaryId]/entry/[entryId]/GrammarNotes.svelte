<script lang="ts">
  import { page } from '$app/state'
  import type { EntryData, MultiString } from '$lib/types'
  import IconMdiBookAlphabet from '~icons/mdi/book-alphabet'

  interface Props {
    entry: EntryData
  }

  const { entry }: Props = $props()
  const { t, dictionary, dict_db } = $derived(page.data)

  const sense_ids = $derived(new Set((entry.senses ?? []).map(sense => sense.id)))

  const sections = $derived([...(dict_db?.grammar_sections.rows ?? [])]
    .filter(section => section.entry_id === entry.id || (section.sense_id && sense_ids.has(section.sense_id)))
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || '')))

  function display_title(value: MultiString | null | undefined): string {
    if (!value) return ''
    for (const bcp of dictionary.gloss_languages ?? []) {
      if (value[bcp]?.trim()) return value[bcp]
    }
    return Object.values(value).find(Boolean) ?? ''
  }
</script>

{#if sections.length}
  <section class="grammar-notes">
    <h3 class="heading">
      <IconMdiBookAlphabet />
      {t('grammar.grammar_notes')}
    </h3>
    <ul>
      {#each sections as section (section.id)}
        <li>
          <a href={`/${dictionary.url}/grammar#section-${section.id}`}>
            {display_title(section.title) || t('grammar.untitled_section')}
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .grammar-notes {
    margin-top: 1.5rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--primary) 3%, var(--background));
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  li {
    margin: 0.25rem 0;
  }

  a {
    color: var(--primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
