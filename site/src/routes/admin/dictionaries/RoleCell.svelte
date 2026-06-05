<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiEmailSendOutline from '~icons/mdi/email-send-outline'
  import IconMdiPlus from '~icons/mdi/plus'
  import UserPickerModal from '$lib/admin/UserPickerModal.svelte'
  import { api_dictionaries_id_roles_role_id_delete } from '../../api/dictionaries/[id]/roles/[role_id]/_call'
  import { api_dictionaries_id_roles_post } from '../../api/dictionaries/[id]/roles/_call'

  interface Editor {
    role_id: string
    user_id: string
    name: string
    email: string | null
  }

  interface Props {
    dictionary_id: string
    role: 'manager' | 'contributor'
    editors: Editor[]
    /** Pending (queued/sent) live invite rows for THIS role on THIS dict. */
    invites: RowType<'invites'>[]
    users: RowType<'users'>[]
    on_change: () => Promise<void>
  }

  let { dictionary_id, role, editors, invites, users, on_change }: Props = $props()

  let show_picker = $state(false)
  let busy = $state(false)

  const exclude_user_ids = $derived(editors.map(editor => editor.user_id))

  async function add_email(email: string) {
    show_picker = false
    if (!email)
      return
    busy = true
    const { error } = await api_dictionaries_id_roles_post(dictionary_id, { target_email: email, role })
    busy = false
    if (error) {
      alert(`Could not add ${role}: ${error.message}`)
      return
    }
    await on_change()
  }

  async function remove(editor: Editor) {
    if (!confirm(`Remove ${editor.name} as ${role}?`))
      return
    busy = true
    const { error } = await api_dictionaries_id_roles_role_id_delete({ dict_id: dictionary_id, role_id: editor.role_id })
    busy = false
    if (error) {
      alert(`Could not remove role: ${error.message}`)
      return
    }
    await on_change()
  }

  async function cancel_invite(invite: RowType<'invites'>) {
    if (!confirm(`Cancel invite to ${invite.target_email}?`))
      return
    invite.status = 'cancelled'
    await invite._save()
    await on_change()
  }
</script>

<div class="role-cell">
  <div class="badges">
    {#each editors as editor (editor.role_id)}
      <span class="badge" title={editor.email ?? ''}>
        <a href="/admin/users/{editor.user_id}" class="badge-name">{editor.name}</a>
        <button type="button" class="badge-x" title="Remove" aria-label="Remove" disabled={busy} onclick={() => remove(editor)}>
          <IconMdiClose />
        </button>
      </span>
    {/each}
    <button type="button" class="add-btn" disabled={busy} onclick={() => show_picker = true}>
      <IconMdiPlus />
      Add
    </button>
  </div>

  {#each invites as invite (invite.id)}
    <div class="invite-chip" title="{invite.inviter_email} invited {invite.target_email}">
      <IconMdiEmailSendOutline />
      <span class="invite-email">{invite.target_email}</span>
      <span class="invite-status">{invite.status}</span>
      <button type="button" class="invite-x" title="Cancel invite" aria-label="Cancel invite" onclick={() => cancel_invite(invite)}>
        <IconMdiClose />
      </button>
    </div>
  {/each}
</div>

{#if show_picker}
  <UserPickerModal
    {users}
    {exclude_user_ids}
    title={`Add ${role}`}
    on_select_email={add_email}
    on_close={() => show_picker = false} />
{/if}

<style>
  .role-cell {
    min-width: 14rem;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.25rem 0.125rem 0.5rem;
    border-radius: 9999px;
    background: var(--surface);
    border: 1px solid var(--border-color);
    font-size: 0.75rem;
    max-width: 12rem;
  }
  .badge-name {
    color: var(--color);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge-name:hover {
    color: var(--primary);
    text-decoration: underline;
  }
  .badge-x {
    display: inline-flex;
    border: 0;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0;
    font-size: 0.875rem;
  }
  .badge-x:hover {
    color: var(--danger);
  }
  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    border: 1px dashed var(--border-color);
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .add-btn:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
  .invite-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--warning), transparent 88%);
    color: var(--color-secondary);
    font-size: 0.6875rem;
  }
  .invite-email {
    color: var(--color);
  }
  .invite-status {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }
  .invite-x {
    display: inline-flex;
    border: 0;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0;
  }
  .invite-x:hover {
    color: var(--danger);
  }
</style>
