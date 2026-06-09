<script lang="ts">
  import type { Persona } from '$lib/auth/view-as'
  import { page } from '$app/state'
  import { dev } from '$app/environment'
  import { invalidateAll } from '$app/navigation'
  import { build_personas, is_active_persona } from '$lib/auth/view-as'
  import { api_dev_admin_level } from '$api/auth/dev-admin-level/_call'
  import { mode } from '$lib/mode'

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
    const input = prompt('Enter 0, 1, or 2')
    const level = input === null ? null : +input
    if (level !== 0 && level !== 1 && level !== 2)
      return
    const { error } = await api_dev_admin_level({ level })
    if (error)
      console.error(error)
    else
      invalidateAll()
  }
</script>

{#if user}
  <div class="px-4 py-2 text-xs font-semibold text-gray-600">{user.name || user.email}</div>
  {#if user.name}
    <div class="px-4 py-2 -mt-3 text-xs text-gray-600 border-b">{user.email}</div>
  {/if}

  {#if auth_user.is_admin}
    <a href="/admin" onclick={close}>
      Admin Panel
      <i class="fas fa-key"></i>
    </a>
  {/if}

  {#if auth_user.real_is_admin}
    <div class="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
      View as
    </div>
    {#each personas as persona (persona.key)}
      <button
        type="button"
        class="flex w-full items-center justify-between"
        onclick={() => select(persona)}>
        <span>{persona.label}</span>
        {#if is_active_persona({ persona, preview: auth_user.preview, real_admin_level: auth_user.real_admin_level })}
          <i class="fas fa-check text-purple-600"></i>
        {/if}
      </button>
    {/each}
    <div class="my-1 border-t"></div>
  {/if}

  <a href="/account" onclick={close}>{t('account.account_settings')}</a>
  <button type="button" onclick={() => { close(); auth_user.logout() }}>{t('account.log_out')}</button>

  {#if dev || mode === 'development'}
    <button type="button" onclick={set_dev_admin_role}>
      Dev: Set Admin Role Level (currently {auth_user.real_admin_level})
    </button>
  {/if}
{/if}
