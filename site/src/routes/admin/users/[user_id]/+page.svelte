<script lang="ts">
  import IconMdiAccountQuestion from '~icons/mdi/account-question'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiAt from '~icons/mdi/at'
  import IconMdiEmailPlusOutline from '~icons/mdi/email-plus-outline'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'
  import IconMdiCheckDecagram from '~icons/mdi/check-decagram'
  import IconMdiEmailOffOutline from '~icons/mdi/email-off-outline'
  import IconMdiForumOutline from '~icons/mdi/forum-outline'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import IconMdiPlus from '~icons/mdi/plus'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import AdminBadge from '$lib/admin/AdminBadge.svelte'
  import DictionaryPickerModal from '$lib/admin/DictionaryPickerModal.svelte'
  import TranslatorLanguagesCard from '$lib/admin/TranslatorLanguagesCard.svelte'
  import ComposeEmailModal from '$lib/admin/messages/compose-email-modal.svelte'
  import { get_admin, get_admin_level, has_super_manager_role } from '$lib/admins'
  import { support_address } from '$lib/email/addresses'
  import CopyButton from '$lib/components/ui/CopyButton.svelte'
  import { use_admin_back } from '$lib/utils/admin-back.svelte'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'
  import { api_admin_user_name } from '../../../api/admin/users/[id]/name/_call'
  import { api_admin_user_chat_access } from '../../../api/admin/users/[id]/chat-access/_call'
  import { api_admin_user_roles } from '../../../api/admin/users/[id]/roles/_call'
  import { api_admin_user_unsubscribe } from '../../../api/admin/users/[id]/unsubscribe/_call'
  import { api_dictionaries_id_roles_post } from '../../../api/dictionaries/[id]/roles/_call'

  let { data } = $props()
  const db = $derived(data.db)
  const user_id = $derived(page.params.user_id)
  const user = $derived(db?.users.id(user_id))
  const is_super_manager = $derived(has_super_manager_role(user?.roles))
  // Admins (level >= 2) always have chat access; the toggle grants it to everyone else.
  const is_admin_user = $derived(get_admin_level(user?.email) !== null)
  // Allow-list tier (2/3) first; else the DB-granted super_manager tier (1).
  const target_admin_level = $derived(user ? (get_admin_level(user.email) ?? (is_super_manager ? 1 : null)) : null)

  const back = use_admin_back({
    fallback: { label: 'All users', url: '/admin/users' },
    compute: (path) => {
      if (path.startsWith('/admin/messages/') && path !== '/admin/messages/' && path !== '/admin/messages/resolved')
        return { label: 'Back to thread', url: path }
      return null
    },
  })

  const aliases_query = $derived(
    db?.email_aliases.query({
      where: 'user_id = ?',
      params: [user_id],
      order_by: 'email ASC',
    }),
  )
  const aliases = $derived(aliases_query?.rows ?? [])

  const roles_query = $derived(
    db?.dictionary_roles.query({
      where: 'user_id = ?',
      params: [user_id],
      order_by: 'created_at DESC',
    }),
  )
  const roles = $derived(roles_query?.rows ?? [])
  const dictionaries = $derived(db?.dictionaries.objects ?? {})

  const threads_query = $derived(
    db?.message_threads.query({
      where: 'from_user_id = ?',
      params: [user_id],
      order_by: 'last_message_at DESC',
    }),
  )
  const threads = $derived(threads_query?.rows ?? [])

  const all_thread_messages_query = $derived(
    db?.messages.query({
      where: 'thread_id IN (SELECT id FROM message_threads WHERE from_user_id = ?)',
      params: [user_id],
    }),
  )
  const message_count = $derived(all_thread_messages_query?.rows.length ?? 0)

  const ROLE_OPTIONS = ['manager', 'contributor'] as const

  const all_dictionaries = $derived(db?.dictionaries.rows ?? [])
  let show_add_role = $state(false)
  let new_role = $state<typeof ROLE_OPTIONS[number]>('manager')
  let adding_role = $state(false)

  async function add_role(dictionary_id: string) {
    if (!user?.email) {
      alert('This user has no email on file, so a role cannot be added.')
      return
    }
    adding_role = true
    const { error } = await api_dictionaries_id_roles_post(dictionary_id, {
      target_email: user.email,
      role: new_role,
    })
    adding_role = false
    show_add_role = false
    if (error) {
      alert(`Could not add role: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  async function update_role(role: { role: string, _save: () => Promise<void> }, value: string) {
    role.role = value as typeof ROLE_OPTIONS[number]
    await role._save()
    await data.sync?.sync()
  }

  async function remove_role(role: { dictionary_id: string, _delete: () => Promise<void> }) {
    const dictionary_name = dictionaries[role.dictionary_id]?.name || role.dictionary_id
    if (!confirm(`Remove this role on "${dictionary_name}"?\n\nThis cannot be undone.`))
      return
    await role._delete()
    await data.sync?.sync()
  }

  const outbound_from = $derived.by(() => {
    const admin = get_admin(data.auth_user?.user?.email)
    return admin
      ? { email: admin.ld_address, name: admin.name }
      : { email: support_address.email, name: support_address.name ?? 'Support' }
  })

  let compose_open = $state(false)

  async function on_compose_sent(thread_id: string) {
    compose_open = false
    await data.sync?.sync()
    await goto(`/admin/messages/${thread_id}`)
  }

  async function edit_name() {
    if (!user)
      return
    const input = prompt('Edit name', user.name ?? '')
    if (input === null)
      return
    const next = input.trim() || null
    if (next === (user.name ?? null))
      return
    // Optimistic in-memory update; `users` is download-only on admin clients,
    // so persistence goes through the admin endpoint (not live-db `_save()`).
    const previous = user.name
    user.name = next
    const { error } = await api_admin_user_name(user.id, { name: input })
    if (error) {
      user.name = previous
      alert(`Could not update name: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  async function toggle_super_manager() {
    if (!user) return
    const next = !has_super_manager_role(user.roles)
    const previous = user.roles
    // Optimistic in-memory update; `users` is download-only on admin clients,
    // so persistence goes through the admin endpoint (not live-db `_save()`).
    user.roles = next ? ['super_manager'] : null
    const { error } = await api_admin_user_roles(user_id, { roles: next ? ['super_manager'] : [] })
    if (error) {
      user.roles = previous
      alert(`Could not update roles: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  async function toggle_chat_access() {
    if (!user) return
    const next = !user.chat_access
    const previous = user.chat_access
    // Optimistic in-memory update; `users` is download-only on admin clients,
    // so persistence goes through the admin endpoint (not live-db `_save()`).
    user.chat_access = next
    const { error } = await api_admin_user_chat_access(user.id, { chat_access: next })
    if (error) {
      user.chat_access = previous
      alert(`Could not update chat access: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  async function toggle_unsubscribed() {
    if (!user) return
    const next = !user.unsubscribed_from_emails
    const previous = user.unsubscribed_from_emails
    // Optimistic in-memory update; `users` is download-only on admin clients,
    // so persistence goes through the admin endpoint (not live-db `_save()`).
    user.unsubscribed_from_emails = next ? new Date().toISOString() : null
    const { error } = await api_admin_user_unsubscribe(user.id, { unsubscribed: next })
    if (error) {
      user.unsubscribed_from_emails = previous
      alert(`Could not update subscription: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }
</script>

<a href={back.target.url} onclick={back.on_click} class="back-link">
  <IconMdiArrowLeft />
  {back.target.label}
</a>

{#if !user}
  <div class="empty">
    <IconMdiAccountQuestion style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>User not found in local DB. They may not have synced yet.</p>
  </div>
{:else}
  <header class="user-header">
    <h1 class="user-title">
      <button type="button" class="name-edit" title="Click to edit name" onclick={edit_name}>
        {user.name || user.email || '(no name)'}
      </button>
      {#if target_admin_level !== null}
        <AdminBadge level={target_admin_level} size="lg" />
      {/if}
    </h1>
    <div class="user-meta">
      {#if user.email}
        <span>{user.email}</span>
        <CopyButton value={user.email} label="Copy email" />
      {/if}
      {#if user.last_visit_at}
        <span>·</span>
        <span title={format_date_time(user.last_visit_at)}>last visit {format_relative_time(user.last_visit_at)}</span>
      {/if}
      {#if user.created_at}
        <span>·</span>
        <span title={format_date_time(user.created_at)}>joined {format_relative_time(user.created_at)}</span>
      {/if}
      {#if user.unsubscribed_from_emails}
        <span>·</span>
        <span class="warn-row"><IconMdiEmailOffOutline />email-unsubscribed</span>
      {/if}
    </div>
    <div class="header-actions">
      {#if user.email}
        <button type="button" onclick={() => (compose_open = true)} class="btn-outline btn-sm">
          <IconMdiEmailPlusOutline style="margin-right: 0.25rem" />
          Compose email
        </button>
      {/if}
      <button
        type="button"
        onclick={toggle_unsubscribed}
        class="btn-outline btn-sm">
        {user.unsubscribed_from_emails ? 'Re-subscribe to emails' : 'Mark unsubscribed'}
      </button>
      {#if !is_admin_user}
        <button
          type="button"
          onclick={toggle_super_manager}
          title="Super managers get dictionary-manager powers on every dictionary (no admin panel access)"
          class="btn-outline btn-sm">
          {is_super_manager ? 'Remove Super Manager' : 'Make Super Manager'}
        </button>
        <button
          type="button"
          onclick={toggle_chat_access}
          title="Chat members can open /chat and DM anyone else in the chat circle"
          class="btn-outline btn-sm">
          <IconMdiForumOutline style="margin-right: 0.25rem" />
          {user.chat_access ? 'Remove chat access' : 'Grant chat access'}
        </button>
      {/if}
    </div>
  </header>

  {#if compose_open && user.email}
    <ComposeEmailModal
      {db}
      from_email={outbound_from.email}
      from_name={outbound_from.name}
      preset_user={{ id: user_id, email: user.email, name: user.name ?? null }}
      on_close={() => (compose_open = false)}
      on_sent={on_compose_sent} />
  {/if}

  <div class="info-grid">
    <section class="card">
      <h2 class="card-heading">
        <IconMdiBookOpenPageVariantOutline />Dictionary roles
        <div class="add-role-controls">
          <select bind:value={new_role} class="role-select" aria-label="Role to add">
            {#each ROLE_OPTIONS as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => show_add_role = true}
            disabled={!user.email || adding_role}
            title={user.email ? 'Add a dictionary role' : 'User has no email — cannot add a role'}
            class="btn-outline btn-sm add-role-btn">
            <IconMdiPlus />
            Add
          </button>
        </div>
      </h2>
      {#if roles.length === 0}
        <p class="card-empty">No dictionary roles.</p>
      {:else}
        <ul class="role-list">
          {#each roles as role (role.id)}
            <li class="role-row">
              <a href="/{role.dictionary_id}" class="role-dict">
                {dictionaries[role.dictionary_id]?.name || role.dictionary_id}
              </a>
              <select
                value={role.role}
                onchange={event => update_role(role, (event.currentTarget as HTMLSelectElement).value)}
                class="role-select">
                {#each ROLE_OPTIONS as option (option)}
                  <option value={option}>{option}</option>
                {/each}
              </select>
              <button
                type="button"
                title="Remove role"
                aria-label="Remove role"
                onclick={() => remove_role(role)}
                class="remove-icon-btn">
                <IconMdiTrashCanOutline />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card">
      <h2 class="card-heading"><IconMdiAt />Email addresses</h2>
      <ul class="alias-list">
        <li class="alias-row">
          <span class="mono">{user.email || '(no primary email)'}</span>
          <span class="alias-source">primary</span>
        </li>
        {#each aliases as alias (alias.email)}
          <li class="alias-row">
            <span class="mono">{alias.email}</span>
            <span class="alias-source">{alias.source}</span>
            {#if alias.verified_at}
              <span class="verified-tag"><IconMdiCheckDecagram />verified</span>
            {/if}
          </li>
        {/each}
        {#if aliases.length === 0}
          <li class="no-aliases">No additional aliases.</li>
        {/if}
      </ul>
    </section>

    <TranslatorLanguagesCard {user_id} />
  </div>

  <section class="card threads-card">
    <h2 class="card-heading">
      <IconMdiForumOutline />Conversations
      <span class="activity-stat">{threads.length} thread{threads.length === 1 ? '' : 's'} · {message_count} message{message_count === 1 ? '' : 's'}</span>
    </h2>
    {#if threads.length === 0}
      <p class="card-empty">No conversations.</p>
    {:else}
      <ul class="thread-list">
        {#each threads as thread (thread.id)}
          <li>
            <a href="/admin/messages/{thread.id}" class="thread-row">
              <span class="thread-subject">{thread.subject || '(no subject)'}</span>
              <span class="thread-time">{format_relative_time(thread.last_message_at)}</span>
              {#if thread.resolved_at}
                <span class="thread-chip resolved">resolved</span>
              {:else if thread.replied_at}
                <span class="thread-chip replied">replied</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if show_add_role}
    <DictionaryPickerModal
      dictionaries={all_dictionaries}
      on_select={add_role}
      on_close={() => show_add_role = false} />
  {/if}
{/if}

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    text-decoration: none;
    transition: color 0.15s;
    margin-bottom: 1rem;
  }
  .back-link:hover {
    color: var(--color);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 4rem;
    padding-bottom: 4rem;
    color: var(--color-secondary);
  }

  .user-header {
    margin-bottom: 1.5rem;
  }
  .user-title {
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .name-edit {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    text-align: left;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: color 0.15s;
  }
  .name-edit:hover {
    color: var(--primary);
  }
  .name-edit:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .user-meta {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.5rem;
  }
  .warn-row {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--warning);
  }
  .header-actions {
    margin-top: 0.75rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  @media (min-width: 768px) {
    .info-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
  }
  .card-heading {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .add-role-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .add-role-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
  }
  .card-empty {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin: 0;
  }
  .activity-stat {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-secondary);
  }

  .role-list,
  .alias-list,
  .thread-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .role-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .role-dict {
    flex: 1;
    min-width: 0;
    color: var(--primary);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role-dict:hover {
    text-decoration: underline;
  }
  .role-select {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
  }
  .remove-icon-btn {
    color: var(--color-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
    padding: 0.25rem;
    display: inline-flex;
  }
  .remove-icon-btn:hover {
    color: var(--danger);
  }

  .alias-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }
  .alias-source {
    font-size: 0.6875rem;
    color: var(--color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .verified-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font-size: 0.6875rem;
    color: var(--success);
  }
  .no-aliases {
    font-size: 0.875rem;
    color: var(--color-secondary);
  }

  .threads-card {
    margin-bottom: 1rem;
  }
  .thread-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--background);
    color: var(--color);
    text-decoration: none;
    transition: background-color 0.15s;
  }
  .thread-row:hover {
    background: color-mix(in srgb, var(--primary), transparent 92%);
  }
  .thread-subject {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
  }
  .thread-time {
    font-size: 0.75rem;
    color: var(--color-secondary);
    white-space: nowrap;
  }
  .thread-chip {
    font-size: 10px;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
  }
  .thread-chip.resolved {
    background: color-mix(in srgb, var(--success), transparent 85%);
    color: var(--success);
  }
  .thread-chip.replied {
    background: var(--surface);
    color: var(--color-secondary);
  }
</style>
