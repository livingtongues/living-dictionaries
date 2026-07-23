<script lang="ts">
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import { page } from '$app/state'
  import { SvelteSet } from 'svelte/reactivity'
  import { get_headword } from '$lib/orthography/orthographies'

  /**
   * Entry-page concordance (.issues/texts-sentences-pipeline.md M3): text
   * sentences whose tokens were confirmed to one of this entry's senses
   * (`senses_in_sentences` + `text_id` NOT NULL). Curated example sentences
   * (`text_id` NULL) stay in the per-sense editable UI — this section is
   * read-only evidence, each row deep-linking into the reader.
   */

  interface Props {
    sense_ids: string[]
  }

  const { sense_ids }: Props = $props()

  const CAP = 5

  const { dict_db, dictionary, t } = $derived(page.data)

  const junction_rows = $derived(sense_ids.length
    ? dict_db?.senses_in_sentences.query({
      where: `sense_id IN (${sense_ids.map(() => '?').join(', ')})`,
      params: sense_ids,
    }).rows ?? []
    : [])

  const items = $derived.by(() => {
    const seen = new SvelteSet<string>()
    const out: DictRowType<'sentences'>[] = []
    for (const junction of junction_rows) {
      if (seen.has(junction.sentence_id))
        continue
      seen.add(junction.sentence_id)
      const sentence = dict_db?.sentences.id(junction.sentence_id)
      if (sentence?.text_id)
        out.push(sentence)
    }
    return out
  })

  let expanded = $state(false)
  const visible = $derived(expanded ? items : items.slice(0, CAP))

  function sentence_display(sentence: DictRowType<'sentences'>): string {
    return get_headword({ lexeme: sentence.text, orthographies: dictionary.orthographies }).value
  }

  function first_translation(sentence: DictRowType<'sentences'>): string {
    return (Object.values(sentence.translation || {}).find(Boolean) as string) || ''
  }

  function text_title(sentence: DictRowType<'sentences'>): string {
    const text = sentence.text_id ? dict_db?.texts.id(sentence.text_id) : null
    return get_headword({ lexeme: text?.title, orthographies: dictionary.orthographies }).value || t('text.untitled')
  }
</script>

{#if items.length}
  <div class="side-section">
    <div class="section-label">
      {items.length === 1
        ? t('token.used_in_sentence')
        : t('token.used_in_sentences', { values: { count: String(items.length) } })}
    </div>
    <div class="occurrences">
      {#each visible as sentence (sentence.id)}
        <a class="occurrence" href={`/${dictionary.url}/text/${sentence.text_id}#${sentence.id}`}>
          <span class="line">{sentence_display(sentence)}</span>
          {#if first_translation(sentence)}
            <span class="translation">{first_translation(sentence)}</span>
          {/if}
          <span class="from-text">{text_title(sentence)}</span>
        </a>
      {/each}
    </div>
    {#if !expanded && items.length > CAP}
      <button type="button" class="btn-ghost btn-sm" onclick={() => expanded = true}>
        {t('token.show_all', { values: { count: String(items.length) } })}
      </button>
    {/if}
  </div>
{/if}

<style>
  .section-label {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.25rem;
  }

  .occurrences {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .occurrence {
    display: flex;
    flex-direction: column;
    padding: 0.375rem 0.5rem;
    margin: 0 -0.5rem;
    border-radius: 0.375rem;
    color: inherit;
    text-decoration: none;
  }

  .occurrence:hover {
    background: var(--surface);
  }

  .line {
    font-size: 0.9375rem;
  }

  .translation {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .from-text {
    font-size: 0.75rem;
    color: var(--primary);
    margin-top: 0.125rem;
  }
</style>
