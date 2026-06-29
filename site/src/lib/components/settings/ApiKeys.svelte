<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/svelte-pieces'
  import type { ApiKeyRecord, ApiKeyRole } from '$lib/api-keys/api-key'
  import { api_create_api_key, api_list_api_keys } from '$api/dictionaries/[id]/api-keys/_call'
  import { api_delete_api_key } from '$api/dictionaries/[id]/api-keys/[key_id]/_call'

  const { dictionary_id }: { dictionary_id: string } = $props()

  let keys = $state<ApiKeyRecord[]>([])
  let loading = $state(true)
  let label = $state('')
  let role = $state<ApiKeyRole>('manager')
  let creating = $state(false)
  let new_token = $state('')
  let copied = $state(false)
  let error_message = $state('')

  onMount(load)

  async function load() {
    loading = true
    const { data, error } = await api_list_api_keys(dictionary_id)
    if (error) {
      error_message = error.message
    } else {
      const { keys: loaded } = data
      keys = loaded
    }
    loading = false
  }

  async function create() {
    error_message = ''
    if (!label.trim()) {
      error_message = 'Give the key a label first.'
      return
    }
    creating = true
    const { data, error } = await api_create_api_key(dictionary_id, { label: label.trim(), role })
    creating = false
    if (error) {
      error_message = error.message
      return
    }
    new_token = data.token
    copied = false
    // eslint-disable-next-line require-atomic-updates -- single-user settings form; no concurrent submit
    label = ''
    await load()
  }

  async function copy() {
    await navigator.clipboard.writeText(new_token)
    copied = true
  }

  async function remove(key: ApiKeyRecord) {
    if (!confirm(`Delete API key "${key.label}"? Any agent using it will immediately lose access.`))
      return
    const { error } = await api_delete_api_key({ dictionary_id, key_id: key.id })
    if (error)
      error_message = error.message
    else
      await load()
  }

  function format_when(iso: string | null): string {
    if (!iso)
      return 'never used'
    return `last used ${new Date(iso).toLocaleDateString()}`
  }
</script>

<div class="api-keys">
  <div class="section-label">API keys</div>
  <p class="hint">
    Programmatic access for agents &amp; scripts — a key can do anything you can on
    <strong>this dictionary</strong>, in bulk. Paste a key into your agent and point it at
    <a href="/api/v1" target="_blank" rel="noopener">/api/v1</a>.
  </p>

  {#if new_token}
    <div class="token-reveal">
      <div class="token-reveal-label">Copy this key now — it won't be shown again:</div>
      <code class="token">{new_token}</code>
      <div class="token-actions">
        <Button onclick={copy} form="fill" color="primary">{copied ? 'Copied ✓' : 'Copy'}</Button>
        <Button onclick={() => (new_token = '')} form="simple" color="black">Done</Button>
      </div>
    </div>
  {/if}

  <div class="create-row">
    <input class="form-input" bind:value={label} placeholder="Label (e.g. Import agent)" maxlength="80" />
    <select class="form-input role-select" bind:value={role}>
      <option value="manager">manager</option>
      <option value="editor">editor</option>
    </select>
    <Button onclick={create} loading={creating} form="fill" color="primary">Create key</Button>
  </div>

  {#if error_message}
    <p class="error">{error_message}</p>
  {/if}

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if keys.length === 0}
    <p class="muted">No API keys yet.</p>
  {:else}
    <ul class="key-list">
      {#each keys as key (key.id)}
        <li class="key-row">
          <code class="key-id">{key.token_prefix}…{key.last_four}</code>
          <span class="key-label">{key.label}</span>
          <span class="key-role">{key.role}</span>
          <span class="muted key-used">{format_when(key.last_used_at)}</span>
          <Button onclick={() => remove(key)} form="simple" color="red" size="sm">Delete</Button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .api-keys {
    margin-bottom: 1.25rem;
  }
  .hint {
    font-size: 0.85rem;
    color: color-mix(in srgb, var(--color) 70%, var(--background));
    margin-bottom: 0.75rem;
  }
  .create-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .create-row .form-input {
    flex: 1 1 auto;
    min-width: 160px;
  }
  .role-select {
    flex: 0 0 auto;
    min-width: 110px;
  }
  .token-reveal {
    background: color-mix(in srgb, var(--primary, #2563eb) 8%, var(--background));
    border: 1px solid color-mix(in srgb, var(--primary, #2563eb) 35%, transparent);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .token-reveal-label {
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .token {
    display: block;
    word-break: break-all;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    background: var(--surface);
    padding: 0.5rem;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }
  .token-actions {
    display: flex;
    gap: 0.5rem;
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    border-radius: 0.5rem;
  }
  .key-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color) 8%, var(--background));
  }
  .key-row:last-child {
    border-bottom: none;
  }
  .key-id {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
  }
  .key-label {
    font-weight: 500;
    flex: 1 1 auto;
  }
  .key-role {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    background: var(--surface);
    padding: 0.1rem 0.45rem;
    border-radius: 0.25rem;
  }
  .key-used {
    font-size: 0.78rem;
  }
  .muted {
    color: color-mix(in srgb, var(--color) 55%, var(--background));
  }
  .error {
    color: #dc2626;
    font-size: 0.85rem;
    margin: 0.25rem 0 0.5rem;
  }
</style>
