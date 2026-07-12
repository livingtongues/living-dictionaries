<script lang="ts">
  import IconIcOutlineMail from '~icons/ic/outline-mail'
  import IconMdiKey from '~icons/mdi/key'
  import EditString from '../[dictionaryId]/EditString.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import { toast } from '$lib/state/toast.svelte'
  import { api_auth_update_profile } from '$api/auth/update-profile/_call'

  const { data } = $props()
  const auth_user = $derived(data.auth_user)
  const user = $derived(auth_user.user)

  let broken_avatar_image = $state(false)
  let saving_newsletter = $state(false)

  async function update_name(full_name: string) {
    const { data: updated_user, error } = await api_auth_update_profile({ name: full_name })
    if (error) {
      alert(`${page.data.t('misc.error')}: ${error.message}`)
      return
    }
    auth_user.set_session({ user: updated_user })
  }

  async function toggle_newsletter(event: Event) {
    const subscribed = (event.currentTarget as HTMLInputElement).checked
    saving_newsletter = true
    const { data: updated_user, error } = await api_auth_update_profile({ unsubscribed_from_emails: !subscribed })
    saving_newsletter = false
    if (error) {
      toast.error(error.message)
      ;(event.currentTarget as HTMLInputElement).checked = !subscribed // revert optimistic state
      return
    }
    auth_user.set_session({ user: updated_user })
    toast.success(page.data.t(subscribed ? 'account.subscribed_to_newsletter' : 'account.unsubscribed_from_newsletter'))
  }
</script>

<svelte:head>
  <title>{page.data.t('account.account_settings')}</title>
</svelte:head>

<Header>{page.data.t('account.account_settings')}</Header>

<div style="max-width: 640px; margin: 0 auto; padding: 0.75rem">
  {#if user}
    <div class="account-card">
      <div class="section header-section">
        {#if user.avatar_url && !broken_avatar_image}
          <img
            alt="Account Profile"
            src={user.avatar_url}
            onerror={() => broken_avatar_image = true}
            style="width: 4rem; height: 4rem; border-radius: 0.5rem; object-fit: cover" />
        {/if}
        <div style="flex: 1; min-width: 0">
          <EditString
            value={user.name}
            minlength={2}
            required
            id="name"
            save={async name => await update_name(name)}
            display={page.data.t('account.your_name')} />
          <div class="email-row">
            <IconIcOutlineMail style="vertical-align: -3px; color: var(--color-secondary)" />
            {user.email}
          </div>
        </div>
      </div>

      {#if auth_user.is_admin}
        <div class="section">
          <a href="/admin" class="admin-link">
            {page.data.t('account.admin_panel')}
            <IconMdiKey style="vertical-align: -2px" />
          </a>
        </div>
      {/if}

      <div class="section">
        <label class="newsletter-toggle">
          <input
            type="checkbox"
            onchange={toggle_newsletter}
            disabled={saving_newsletter}
            checked={!user.unsubscribed_from_emails} />
          {page.data.t('account.receive_newsletter')}
        </label>
      </div>

      <HeadlessButton class="btn btn-default" onclick={() => auth_user.logout()}>{page.data.t('account.log_out')}</HeadlessButton>
    </div>
  {:else}
    <p style="color: var(--color-secondary)">Not logged in</p>
  {/if}
</div>

<style>
  .account-card {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .section {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .header-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .email-row {
    margin-top: 0.5rem;
    font-size: 1rem;
    color: var(--color);
  }

  .admin-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--background);
    background: var(--color);
    border-radius: 0.5rem;
    text-decoration: none;
    transition: background-color var(--transition-time);
  }

  .admin-link:hover {
    background: color-mix(in srgb, var(--color) 85%, var(--background));
  }

  .newsletter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    color: var(--color);
    cursor: pointer;
  }

  .newsletter-toggle input {
    width: 1.1rem;
    height: 1.1rem;
    cursor: pointer;
  }
</style>
