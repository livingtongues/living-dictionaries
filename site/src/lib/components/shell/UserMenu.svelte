<script lang="ts">
  import type { Persona } from '$lib/auth/view-as'
  import { page } from '$app/state'
  import { dev } from '$app/environment'
  import { invalidateAll } from '$app/navigation'
  import { build_personas, is_active_persona } from '$lib/auth/view-as'
  import { api_dev_admin_level } from '$api/auth/dev-admin-level/_call'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import { mode } from '$lib/mode'
  import ColorSchemeToggle from './ColorSchemeToggle.svelte'

  interface Props {
    /** Close the dropdown — called after navigations / sign out (persona switches keep it open). */
    close: () => void
  }

  let { close }: Props = $props()

  const auth_user = $derived(page.data.auth_user)
  const user = $derived(auth_user.user)
  const t = $derived(page.data.t)
  const personas = $derived(build_personas({ real_admin_level: auth_user.real_admin_level }))

  function select(persona: Persona) {
    if (persona.admin_level === auth_user.real_admin_level)
      auth_user.exit_preview()
    else
      auth_user.set_preview({ admin_level: persona.admin_level })
  }

  async function set_dev_admin_role() {
    const input = prompt('Enter 0 (regular), 1 (super manager), 2 (admin), or 3 (super admin)')
    const level = input === null ? null : +input
    if (level !== 0 && level !== 1 && level !== 2 && level !== 3)
      return
    const { error } = await api_dev_admin_level({ level })
    if (error)
      console.error(error)
    else
      invalidateAll()
  }
</script>

{#if user}
  <div class="user-name">{user.name || user.email}</div>
  {#if user.name}
    <div class="user-email">{user.email}</div>
  {/if}

  {#if auth_user.is_admin}
    <a href="/admin" onclick={close}>
      Admin Panel
      <i class="fas fa-key"></i>
    </a>
  {/if}

  {#if auth_user.is_chat_member}
    <a href="/chat" onclick={close}>
      Chat
      {#if chat_store.total_unread > 0}
        <span class="chat-badge">{chat_store.total_unread}</span>
      {:else}
        <i class="far fa-comments"></i>
      {/if}
    </a>
  {/if}

  {#if auth_user.is_translator}
    <a href="/translate" onclick={close}>
      Translate
      <i class="fas fa-language"></i>
    </a>
  {/if}

  {#if auth_user.real_is_admin}
    <div class="view-as-heading">
      View as
    </div>
    {#each personas as persona (persona.key)}
      <button
        type="button"
        class="persona-button"
        onclick={() => select(persona)}>
        <span>{persona.label}</span>
        {#if is_active_persona({ persona, preview: auth_user.preview, real_admin_level: auth_user.real_admin_level })}
          <i class="fas fa-check active-check"></i>
        {/if}
      </button>
    {/each}
    <div class="divider"></div>
  {/if}

  <a href="/account" onclick={close}>{t('account.account_settings')}</a>
  <ColorSchemeToggle />
  <button type="button" onclick={() => { close(); auth_user.logout() }}>{t('account.log_out')}</button>

  {#if dev || mode === 'development'}
    <button type="button" onclick={set_dev_admin_role}>
      Dev: Set Admin Role Level (currently {auth_user.real_admin_level})
    </button>
  {/if}
{/if}

<style>
  .user-name {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
  }

  .user-email {
    padding: 0.5rem 1rem;
    margin-top: -0.75rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    border-bottom: 1px solid var(--border-color);
  }

  .chat-badge {
    background: var(--primary);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .view-as-heading {
    padding: 0.5rem 1rem 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: color-mix(in srgb, var(--color) 45%, var(--background));
  }

  .persona-button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
  }

  .active-check {
    color: #9333ea; /* purple-600 — carried over from the house port; restyle to var(--primary) is a logged post-parity improvement */
  }

  .divider {
    margin: 0.25rem 0;
    border-top: 1px solid var(--border-color);
  }
</style>
