<script lang="ts">
  import type { TranslateRow } from '$lib/server/i18n/i18n-db'
  import { translate_store } from './translate-store.svelte'
  import { missing_placeholders, split_on_placeholders } from './placeholders'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import IconMdiAlertOutline from '~icons/mdi/alert-outline'

  interface Props {
    row: TranslateRow
  }

  let { row }: Props = $props()

  // This component is keyed by locale + key, so a fresh row intentionally seeds a fresh draft.
  // svelte-ignore state_referenced_locally
  let draft = $state(row.value ?? '')
  let saving = $state(false)
  let saved_flash = $state(false)

  const dirty = $derived(draft !== (row.value ?? ''))
  const missing_tokens = $derived(missing_placeholders({ en_value: row.en_value, value: draft }))
  const en_parts = $derived(split_on_placeholders(row.en_value))

  async function save() {
    if (!dirty || saving)
      return
    saving = true
    const ok = await translate_store.save({ key_id: row.key_id, value: draft })
    saving = false
    if (ok) {
      draft = row.value ?? ''
      saved_flash = true
      setTimeout(() => saved_flash = false, 2000)
    }
  }

  async function approve() {
    if (saving)
      return
    saving = true
    await translate_store.approve({ key_id: row.key_id })
    saving = false
  }

  function autosize(el: HTMLTextAreaElement) {
    const grow = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    grow()
    el.addEventListener('input', grow)
    return () => el.removeEventListener('input', grow)
  }
</script>

<div class="row" class:flagged={!!row.needs_review}>
  <div class="header">
    <div class="key">{row.key_id}</div>
    <div class="status">
      {#if !row.value && !draft}
        <span class="chip missing">Untranslated</span>
      {:else if row.needs_review === 'ai'}
        <span class="reason ai"><IconMdiRobotOutline /> AI translation — please review</span>
      {:else if row.needs_review === 'en_changed'}
        <span class="reason review"><IconMdiAlertOutline /> English changed — please review</span>
      {/if}
      {#if missing_tokens.length}
        <span class="chip warn">Missing {missing_tokens.join(' ')}</span>
      {/if}
      {#if row.updated_at}
        <span class="when" title={row.updated_at}>{#if !row.needs_review && row.updated_by_name}{row.updated_by_name} · {/if}{format_relative_time(row.updated_at)}</span>
      {/if}
      {#if dirty}
        <button type="button" class="btn-primary btn-sm" disabled={saving} onclick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      {:else if saving}
        <span class="saved saving"><IconMdiCheck /> Saving…</span>
      {:else if saved_flash}
        <span class="saved"><IconMdiCheck /> Saved</span>
      {:else if row.needs_review && row.value}
        <button type="button" class="approve" disabled={saving} onclick={approve}>
          <IconMdiCheck /> Looks good
        </button>
      {/if}
    </div>
  </div>
  <div class="body">
    <div class="en">{#each en_parts as part, index (index)}{#if part.is_token}<code class="token">{part.text}</code>{:else}{part.text}{/if}{/each}</div>
    <textarea
      dir="auto"
      rows="1"
      placeholder="Translate…"
      bind:value={draft}
      {@attach autosize}
      onblur={save}
      onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) (event.target as HTMLTextAreaElement).blur() }}></textarea>
  </div>
</div>

<style>
  .row {
    padding: 0.625rem 0.75rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color-secondary) 16%, transparent);
    border-radius: 0.75rem;
    background: var(--background);
    margin-bottom: 0.625rem;
  }

  .row.flagged {
    background: color-mix(in srgb, var(--warning) 7%, var(--background));
    border-color: color-mix(in srgb, var(--warning) 28%, transparent);
  }

  .row:hover {
    border-color: color-mix(in srgb, var(--color-secondary) 32%, transparent);
  }

  .row.flagged:hover {
    border-color: color-mix(in srgb, var(--warning) 45%, transparent);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.375rem 0.75rem;
    margin-bottom: 0.5rem;
  }

  .status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .reason {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.125rem 0.5rem;
  }

  .reason.review {
    background: color-mix(in srgb, var(--warning) 15%, var(--background));
    color: color-mix(in srgb, var(--warning) 70%, var(--color));
  }

  .reason.ai {
    --ai: var(--cat-ai, hsl(258, 70%, 60%));
    background: color-mix(in srgb, var(--ai) 15%, var(--background));
    color: color-mix(in srgb, var(--ai) 68%, var(--color));
  }

  .when {
    font-size: 0.6875rem;
    color: color-mix(in srgb, var(--color-secondary) 80%, var(--background));
    white-space: nowrap;
  }

  .approve {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--success) 42%, transparent);
    background: color-mix(in srgb, var(--success) 12%, var(--background));
    color: color-mix(in srgb, var(--success) 80%, var(--color));
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition-time, 150ms), border-color var(--transition-time, 150ms);
  }

  .approve:hover {
    background: color-mix(in srgb, var(--success) 22%, var(--background));
    border-color: color-mix(in srgb, var(--success) 60%, transparent);
  }

  .body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: 1fr;
      gap: 0.375rem;
    }
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: color-mix(in srgb, var(--color-secondary) 75%, var(--background));
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .en {
    font-size: 0.875rem;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .token {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    border-radius: 0.25rem;
    padding: 0 0.25rem;
  }

  textarea {
    width: 100%;
    background: var(--background);
    border: 1px solid color-mix(in srgb, var(--color-secondary) 32%, var(--background));
    border-radius: 0.375rem;
    padding: 0.375rem 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    letter-spacing: inherit;
    line-height: 1.45;
    color: inherit;
    resize: none;
    overflow: hidden;
    min-height: 2rem;
    box-shadow: none;
    transition: border-color var(--transition-time, 150ms), box-shadow var(--transition-time, 150ms), background var(--transition-time, 150ms);
  }

  textarea::placeholder {
    color: color-mix(in srgb, var(--color-secondary) 55%, var(--background));
    font-style: italic;
  }

  textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 3%, var(--background));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.125rem 0.5rem;
  }

  .chip.missing {
    background: color-mix(in srgb, var(--color-secondary) 12%, var(--background));
    color: var(--color-secondary);
  }

  .chip.warn {
    background: color-mix(in srgb, var(--danger) 12%, var(--background));
    color: var(--danger);
    font-family: var(--font-mono);
  }

  .saved {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--success);
  }

  .saved.saving {
    color: var(--color-secondary);
    font-weight: 500;
  }
</style>
