<script lang="ts">
  import type { Persona } from '$lib/auth/view-as'
  import { page } from '$app/state'
  import { browser, dev } from '$app/environment'
  import { invalidateAll } from '$app/navigation'
  import IconMdiCellphoneArrowDown from '~icons/mdi/cellphone-arrow-down'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiCog from '~icons/mdi/cog'
  import IconMdiForum from '~icons/mdi/forum'
  import IconMdiKey from '~icons/mdi/key'
  import IconMdiLogout from '~icons/mdi/logout'
  import IconMdiTranslate from '~icons/mdi/translate'
  import IconMdiWrench from '~icons/mdi/wrench'
  import { build_personas, is_active_persona } from '$lib/auth/view-as'
  import { api_dev_admin_level } from '$api/auth/dev-admin-level/_call'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import { mode } from '$lib/mode'
  import { pwa_install } from '$lib/state/pwa-install.svelte'
  import { toast } from '$lib/state/toast.svelte'
  import ColorSchemeToggle from './ColorSchemeToggle.svelte'

  interface Props {
    /** Close the menu — called after navigations / sign out (persona switches keep it open). */
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

  // UserMenu is only ever mounted client-side in the real app (opened from a
  // button click) — but svelte-look SSR-renders stories directly, so guard
  // with `browser` rather than assuming `window` exists.
  const is_mobile = browser && window.matchMedia('(pointer: coarse)').matches
  const show_add_to_home_screen = $derived(
    is_mobile && !pwa_install.installed && (pwa_install.can_prompt || pwa_install.is_ios),
  )

  async function add_to_home_screen() {
    if (pwa_install.can_prompt) {
      close()
      await pwa_install.prompt()
    } else if (pwa_install.is_ios) {
      close()
      toast(t('account.add_to_home_screen_ios_instructions'), { dismiss_label: t('account.got_it') })
    }
  }
</script>

{#if user}
  <div class="menu">
    <a href="/account" onclick={close} class="account-link" title={t('account.account_settings')}>
      <span class="who">
        <span class="user-name">{user.name || user.email}</span>
        {#if user.name}
          <span class="user-email">{user.email}</span>
        {/if}
      </span>
      <IconMdiCog />
    </a>

    {#if auth_user.is_admin}
      <a href="/admin" onclick={close}>
        <IconMdiKey />
        Admin Panel
      </a>
    {/if}

    {#if auth_user.is_chat_member}
      <a href="/chat" onclick={close}>
        <IconMdiForum />
        Chat
        {#if chat_store.total_unread > 0}
          <span class="chat-badge">{chat_store.total_unread}</span>
        {/if}
      </a>
    {/if}

    {#if auth_user.is_translator}
      <a href="/translate" onclick={close}>
        <IconMdiTranslate />
        Translate
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
            <IconMdiCheck style="color: var(--primary)" />
          {/if}
        </button>
      {/each}
      <div class="divider"></div>
    {/if}

    <ColorSchemeToggle />

    {#if show_add_to_home_screen}
      <button type="button" onclick={add_to_home_screen}>
        <IconMdiCellphoneArrowDown />
        {t('account.add_to_home_screen')}
      </button>
    {/if}

    <button type="button" onclick={() => { close(); auth_user.logout() }}>
      <IconMdiLogout />
      {t('account.log_out')}
    </button>

    {#if dev || mode === 'development'}
      <button type="button" onclick={set_dev_admin_role}>
        <IconMdiWrench />
        Dev: Set Admin Role Level (currently {auth_user.real_admin_level})
      </button>
    {/if}
  </div>
{/if}

<style>
  .menu {
    display: flex;
    flex-direction: column;
    padding: 0.25rem 0;
  }

  .menu :global(:is(a, button)) {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 1rem;
    text-align: left;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
    transition: background-color 150ms;
  }

  .menu :global(:is(a, button)):hover {
    background-color: var(--surface);
  }

  .menu :global(svg) {
    flex-shrink: 0;
    color: var(--color-secondary);
  }

  .account-link {
    border-bottom: 1px solid var(--border-color);
  }

  .who {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-right: auto;
    min-width: 0;
  }

  .user-name {
    font-weight: 600;
  }

  .user-name,
  .user-email {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-email {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary);
  }

  .chat-badge {
    margin-left: auto;
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
    color: var(--color-secondary);
  }

  .persona-button {
    justify-content: space-between;
  }

  .divider {
    margin: 0.25rem 0;
    border-top: 1px solid var(--border-color);
  }
</style>
