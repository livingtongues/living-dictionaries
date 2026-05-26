<script lang="ts">
  import type { DictConnection } from '$lib/db/dict-client/dict-connection'
  import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { api_dev_seed_test_dict } from '$api/dev/seed-test-dict/_call'
  import { create_dict_live_db } from '$lib/db/dict-client/dict-live-db.svelte'
  import { open_dict } from '$lib/db/dict-client/shared-worker-lifecycle'
  import { onDestroy, onMount } from 'svelte'

  /**
   * Dev-only cross-tab sync verification page.
   *
   * Flow:
   *   1. Require a logged-in session (redirect to /login if absent).
   *   2. Seed the test dict + role grant via `/api/dev/seed-test-dict`.
   *   3. Open the dict via the SharedWorker (`shared-worker-lifecycle.open_dict`).
   *   4. Wrap the connection in a `DictLiveDb` for reactive entries.
   *   5. Render entries + add UI.
   *
   * Open this page in two tabs to verify cross-tab sync: an add in one tab
   * should appear in the other within ~postMessage latency.
   */

  const dict_id = $derived(page.params.id || 'test-dict-1')
  const auth_user = $derived(page.data.auth_user)

  let status = $state<'init' | 'ready' | 'error'>('init')
  let status_detail = $state('')
  let live_db = $state<DictLiveDb | null>(null)
  let connection: DictConnection | null = null
  let opfs_backed = $state(false)
  let last_broadcast = $state<string>('')

  let new_lexeme_en = $state('')

  const entries = $derived(live_db?.entries.rows ?? [])
  const loading = $derived(live_db?.entries.loading ?? true)

  onMount(async () => {
    try {
      const user = auth_user?.user ?? null
      if (!user) {
        await goto(`/login?redirect=${encodeURIComponent(page.url.pathname)}`)
        return
      }

      const seed = await api_dev_seed_test_dict({ dict_id })
      if (seed.error) {
        status = 'error'
        status_detail = `Seed failed: ${seed.error.message}`
        return
      }

      connection = await open_dict({
        dict_id,
        has_editor_role: true,
        auth: {},
      })
      opfs_backed = connection.is_opfs_backed

      const unsubscribe = connection.subscribe_broadcasts((broadcast) => {
        last_broadcast = `${broadcast.type} @ ${new Date().toLocaleTimeString()}`
      })
      onDestroy(unsubscribe)

      live_db = create_dict_live_db(connection)
      status = 'ready'
    } catch (err) {
      status = 'error'
      status_detail = (err as Error).message
      console.error('[test page] init failed', err)
    }
  })

  onDestroy(() => {
    live_db?.destroy()
    void connection?.close()
  })

  async function add_entry() {
    if (!live_db || !new_lexeme_en.trim()) return
    const user = auth_user?.user
    if (!user) return
    const now = new Date().toISOString()
    await live_db.entries.insert({
      lexeme: { en: new_lexeme_en.trim() },
      created_at: now,
      updated_at: now,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
    new_lexeme_en = ''
  }

  async function delete_entry(id: string) {
    await live_db?.entries.delete(id)
  }

  async function force_sync() {
    await connection?.sync_now()
  }
</script>

<div class="container">
  <h1>Dict-sync verification</h1>
  <p class="subtle">
    Dict: <code>{dict_id}</code>
    · OPFS-backed: <code>{opfs_backed}</code>
    · last broadcast: <code>{last_broadcast || 'none'}</code>
  </p>

  {#if status === 'init'}
    <p>Initializing…</p>
  {:else if status === 'error'}
    <p class="error">Error: {status_detail}</p>
  {:else if status === 'ready'}
    <section>
      <h2>Add entry</h2>
      <form onsubmit={(event) => { event.preventDefault(); void add_entry() }}>
        <input
          type="text"
          bind:value={new_lexeme_en}
          placeholder="English lexeme (e.g. 'hello')"
          autocomplete="off" />
        <button type="submit" disabled={!new_lexeme_en.trim()}>Add</button>
      </form>
      <button type="button" onclick={force_sync}>Force sync now</button>
    </section>

    <section>
      <h2>Entries ({entries.length}) {loading ? '· loading…' : ''}</h2>
      <ul>
        {#each entries as entry (entry.id)}
          <li>
            <span class="lexeme">{entry.lexeme?.en ?? '(no en lexeme)'}</span>
            <span class="subtle">
              dirty={String(entry.dirty ?? null)} ·
              updated={entry.updated_at?.slice(11, 19)}
            </span>
            <button type="button" onclick={() => delete_entry(entry.id)}>×</button>
          </li>
        {:else}
          <li class="subtle">No entries yet. Add one above.</li>
        {/each}
      </ul>
    </section>

    <section>
      <h2>How to verify cross-tab sync</h2>
      <ol>
        <li>Open this same URL in a second tab.</li>
        <li>Add an entry in tab A — it should appear in tab B within milliseconds.</li>
        <li>Delete an entry in tab A — it disappears in tab B.</li>
      </ol>
      <p class="subtle">
        Identity: <code>{auth_user?.user?.email ?? '?'}</code>
        — change by logging out and logging in as someone else.
      </p>
    </section>
  {/if}
</div>

<style>
  .container {
    max-width: 640px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
  section { margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 6px; }
  .subtle { color: #888; font-size: 0.85em; }
  .error { color: #c00; }
  .lexeme { font-weight: 500; flex: 1; }
  form { display: flex; gap: 0.5rem; }
  input[type="text"] { flex: 1; padding: 0.4rem; font-size: 1em; }
  button { padding: 0.4rem 0.8rem; cursor: pointer; }
  ul { list-style: none; padding: 0; }
  li { display: flex; gap: 0.5rem; align-items: center; padding: 0.25rem 0; }
  code { background: #f4f4f4; padding: 0.1em 0.4em; border-radius: 3px; font-size: 0.9em; }
</style>
