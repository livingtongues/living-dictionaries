<script lang="ts">
  import { page } from '$app/state'
  import { first_multistring_value } from './grammar-tree'
  import { get_headword } from '$lib/orthography/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'

  const { t, dictionary, dict_db, entries_data } = $derived(page.data)

  const slots = $derived([...(dict_db?.clause_slots.rows ?? [])]
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || '')))

  const sections = $derived([...(dict_db?.grammar_sections.rows ?? [])])

  function slot_label(name: Record<string, string> | null): string {
    return first_multistring_value(name, dictionary.gloss_languages)
  }

  function particles_in(slot_id: string): DictRowType<'grammar_sections'>[] {
    return sections
      .filter(section => section.slot_id === slot_id)
      .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || ''))
  }

  function particle_label(section: DictRowType<'grammar_sections'>): string {
    const title = first_multistring_value(section.title, dictionary.gloss_languages)
    if (title) return title
    if (section.entry_id) {
      const entry = $entries_data[section.entry_id]
      if (entry) return get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value
    }
    return t('grammar.untitled_section')
  }
</script>

{#if slots.length}
  <div class="clause-template">
    <span class="heading">{t('grammar.clause_template')}</span>
    <div class="strip">
      {#each slots as slot, index (slot.id)}
        {#if index > 0}<span class="arrow" aria-hidden="true">→</span>{/if}
        <div class="slot">
          <div class="slot-name">
            {slot_label(slot.name) || slot.code || '—'}
            {#if slot.code && slot_label(slot.name)}<span class="slot-code">{slot.code}</span>{/if}
          </div>
          <div class="particles">
            {#each particles_in(slot.id) as section (section.id)}
              <a class="particle" href={`#section-${section.id}`}>{particle_label(section)}</a>
            {:else}
              <span class="particle empty">{t('grammar.slot_unassigned')}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .clause-template {
    margin-bottom: 1rem;
  }

  .heading {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }

  .strip {
    display: flex;
    align-items: stretch;
    gap: 0.375rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .arrow {
    align-self: center;
    color: var(--color-secondary);
    flex-shrink: 0;
  }

  .slot {
    flex-shrink: 0;
    min-width: 7rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.5rem;
    background: var(--background);
  }

  .slot-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color);
    margin-bottom: 0.375rem;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .slot-code {
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--color-secondary);
  }

  .particles {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .particle {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    background: color-mix(in srgb, var(--primary) 10%, var(--background));
    color: var(--primary);
    text-decoration: none;
  }

  .particle:hover {
    background: color-mix(in srgb, var(--primary) 18%, var(--background));
  }

  .particle.empty {
    background: transparent;
    color: var(--color-secondary);
    font-style: italic;
    padding-left: 0;
  }
</style>
