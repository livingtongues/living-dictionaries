<script lang="ts">
  import { ADMINS } from '$lib/admins'
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import IconMdiAccountArrowRight from '~icons/mdi/account-arrow-right'
  import IconMdiLoading from '~icons/mdi/loading'
  import { api_messages_assign } from '../../routes/api/messages/assign/_call'

  interface Props {
    db: LiveDb | null | undefined
    thread_id: string
    assigned_to_user_id: string | null | undefined
    /**
     * Map of admin email → user_id, resolved by the parent (so all rows share
     * one batched query instead of N×M per-dropdown queries). Pass null to fall
     * back to a per-dropdown lookup — useful when this is the only dropdown on
     * a page and there's no parent map to share.
     */
    admin_user_id_by_email?: Map<string, string> | null
    /** Optional callback after a successful save (e.g. trigger a sync). */
    onassigned?: (next_user_id: string | null) => void | Promise<void>
    /** 'sm' = small inline (table rows). 'md' = default header chip. */
    size?: 'sm' | 'md'
  }
  let { db, thread_id, assigned_to_user_id, admin_user_id_by_email: admin_user_id_by_email_prop, onassigned, size = 'md' }: Props = $props()

  // If the parent didn't provide a pre-computed map, derive our own. Use one batched
  // `email IN (?,?,?,?)` query so we don't risk the per-admin race where the first
  // instance on the page sees empty results.
  const own_admin_users_query = $derived.by(() => {
    if (admin_user_id_by_email_prop || !db) return null
    const placeholders = ADMINS.map(() => '?').join(',')
    return db.users.query({
      where: `email IN (${placeholders})`,
      params: ADMINS.map(a => a.email),
    })
  })
  const admin_user_id_by_email = $derived.by(() => {
    if (admin_user_id_by_email_prop) return admin_user_id_by_email_prop
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string>()
    for (const row of own_admin_users_query?.rows ?? []) {
      if (row.email) map.set(row.email, row.id)
    }
    return map
  })

  const assignee_admin = $derived.by(() => {
    if (!assigned_to_user_id) return null
    for (const admin of ADMINS) {
      if (admin_user_id_by_email.get(admin.email) === assigned_to_user_id) return admin
    }
    return null
  })

  let saving = $state(false)
  let error_msg = $state<string | null>(null)

  async function on_change(event: Event) {
    const target = event.currentTarget as HTMLSelectElement
    const { value } = target
    const next_user_id = value === '' ? null : value
    saving = true
    error_msg = null
    try {
      await api_messages_assign({ thread_id, assignee_user_id: next_user_id })
      await onassigned?.(next_user_id)
    } catch (err) {
      error_msg = (err as Error).message
      // Revert the select to its previous value on failure
      target.value = assigned_to_user_id ?? ''
    } finally {
      saving = false
    }
  }
</script>

<span class="assignee-row">
  {#if size === 'md'}
    <IconMdiAccountArrowRight style="color: var(--color-secondary)" />
  {/if}
  <select
    onchange={on_change}
    disabled={saving}
    class={['assignee-select', size === 'sm' ? 'select-sm' : 'select-md']}
    title={assignee_admin ? `Assigned to ${assignee_admin.name}` : 'Unassigned — click to assign'}>
    <option value="" selected={!assigned_to_user_id}>— unassigned</option>
    {#each ADMINS as admin (admin.email)}
      {@const user_id = admin_user_id_by_email.get(admin.email)}
      {#if user_id}
        <option value={user_id} selected={user_id === assigned_to_user_id}>{admin.name}</option>
      {/if}
    {/each}
  </select>
  {#if saving}
    <IconMdiLoading class="animate-spin" style="color: var(--color-secondary); font-size: 0.75rem" />
  {/if}
</span>

{#if error_msg}
  <div class="error">{error_msg}</div>
{/if}

<style>
  .assignee-row {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .assignee-select {
    border-radius: 0.25rem;
    color: var(--color);
    cursor: pointer;
  }
  .assignee-select:focus {
    outline: none;
  }
  .select-sm {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: transparent;
    border: 1px solid transparent;
  }
  .select-sm:hover {
    border-color: var(--border-color);
  }
  .select-sm:focus {
    border-color: var(--primary);
  }
  .select-md {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
  }
  .select-md:hover,
  .select-md:focus {
    border-color: var(--primary);
  }
  .error {
    font-size: 0.75rem;
    color: var(--danger);
    margin-top: 0.25rem;
  }
</style>
