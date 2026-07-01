<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/svelte-pieces'
  import type { ApiKeyRecord, ApiKeyRole } from '$lib/api-keys/api-key'
  import { api_create_api_key, api_list_api_keys } from '$api/dictionaries/[id]/api-keys/_call'
  import { api_revoke_api_key } from '$api/dictionaries/[id]/api-keys/[key_id]/_call'

  // `can_manage` (managers) gates minting + revoking; editors get a read-only list.
  const { dictionary_id, can_manage = true }: { dictionary_id: string, can_manage?: boolean } = $props()

  let keys = $state<ApiKeyRecord[]>([])
  let loading = $state(true)
  let label = $state('')
  let role = $state<ApiKeyRole>('write')
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

  async function revoke(key: ApiKeyRecord) {
    if (!confirm(`Revoke API key "${key.label}"? Any agent using it will immediately lose access.`))
      return
    const { error } = await api_revoke_api_key({ dictionary_id, key_id: key.id })
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

  function role_label(key_role: ApiKeyRole): string {
    return key_role === 'read' ? 'Read only' : 'Read & write'
  }
</script>

<div class="api-keys">
  <div class="section-label">API keys</div>
  <p class="hint">
    Programmatic access for agents &amp; scripts — a key can do anything you can on
    <strong>this dictionary</strong>, in bulk. Give each key the least access an agent needs.
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

  {#if can_manage}
    <div class="create-row">
      <label class="field field-grow">
        <span class="field-label">Label</span>
        <input class="form-input" bind:value={label} placeholder="Dictionary agent" maxlength="80" />
      </label>
      <label class="field">
        <span class="field-label">Access</span>
        <select class="form-input role-select" bind:value={role}>
          <option value="write">Read &amp; write</option>
          <option value="read">Read only</option>
        </select>
      </label>
      <Button onclick={create} loading={creating} form="fill" color="primary">Create key</Button>
    </div>

    <p class="role-hint">
      <strong>Read &amp; write</strong> keys can add &amp; edit content; <strong>read only</strong> keys can only fetch — pick the least an agent needs.
    </p>
  {/if}

  {#if error_message}
    <p class="error">{error_message}</p>
  {/if}

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if keys.length > 0}
    <ul class="key-list">
      {#each keys as key (key.id)}
        <li class="key-row">
          <code class="key-id">{key.token_prefix}…{key.last_four}</code>
          <span class="key-label">{key.label}</span>
          <span class="key-role">{role_label(key.role)}</span>
          <span class="muted key-used">{format_when(key.last_used_at)}</span>
          {#if can_manage}
            <Button onclick={() => revoke(key)} form="simple" color="red" size="sm">Revoke</Button>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">No agent keys yet.</p>
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
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-grow {
    flex: 1 1 auto;
    min-width: 160px;
  }
  .field-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 70%, var(--background));
  }
  .field .form-input {
    width: 100%;
  }
  .role-select {
    min-width: 150px;
  }
  .role-hint {
    font-size: 0.78rem;
    color: color-mix(in srgb, var(--color) 60%, var(--background));
    margin: 0 0 0.5rem;
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
