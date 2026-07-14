<script lang="ts">
  import { page } from '$app/state'
  import { get_headword } from '$lib/helpers/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'

  interface Props {
    sentence: DictRowType<'sentences'>
    /** Show the sentence text as a deep-link into its text (when it belongs to one). */
    link?: boolean
  }

  const { sentence, link = true }: Props = $props()

  const { t, dictionary } = $derived(page.data)

  const headword = $derived(get_headword({ lexeme: sentence.text, orthographies: dictionary.orthographies }).value)
  const translations = $derived(Object.values(sentence.translation || {}).filter(Boolean) as string[])
  const href = $derived(link && sentence.text_id
    ? `/${dictionary.url}/text/${sentence.text_id}#s-${sentence.id}`
    : link
    ? `/${dictionary.url}/sentence/${sentence.id}`
    : null)
</script>

<div class="example">
  <div class="line">
    {#if href}
      <a class="headword" {href}>{headword || '—'}</a>
    {:else}
      <span class="headword">{headword || '—'}</span>
    {/if}
    {#if sentence.discourse_role}
      <span class="discourse-badge" title={t('discourse.role')}>
        {t({ dynamicKey: `discourse.${sentence.discourse_role}`, fallback: sentence.discourse_role })}
      </span>
    {/if}
    {#if sentence.example_label}
      <span class="example-label">{sentence.example_label}</span>
    {/if}
  </div>
  {#each translations as translation, index (index)}
    <div class="translation">{translation}</div>
  {/each}
</div>

<style>
  .example {
    padding: 0.375rem 0 0.375rem 0.75rem;
    border-left: 2px solid color-mix(in srgb, var(--color) 12%, transparent);
  }

  .line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .headword {
    font-weight: 500;
    color: var(--color);
    text-decoration: none;
  }

  a.headword:hover {
    text-decoration: underline;
  }

  .discourse-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    color: var(--color-secondary);
    background: color-mix(in srgb, var(--color) 8%, var(--background));
  }

  .example-label {
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }

  .translation {
    font-size: 0.9375rem;
    color: var(--color-secondary);
    line-height: 1.4;
  }
</style>
