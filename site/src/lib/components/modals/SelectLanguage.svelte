<script lang="ts">
  import IconKey from '~icons/fa-solid/key'
  import IconHandHeart from '~icons/mdi/hand-heart-outline'
  import IconCheck from '~icons/fa-solid/check'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import { page } from '$app/state'
  import { changeLocale, locales, unpublishedLocales } from '$lib/i18n/change-locale'
  import { api_contact } from '$api/contact/_call'
  import { toast } from '$lib/state/toast.svelte'

  interface Props {
    on_close: () => void
  }

  const { on_close }: Props = $props()

  const { auth_user, locale, t } = $derived(page.data)
  const locales_with_translators = $derived<string[]>(page.data.locales_with_translators ?? [])

  /** A published, non-English locale with no assigned translator is open for reviewer recruiting. */
  function needs_reviewer(bcp: string): boolean {
    return bcp !== 'en' && !locales_with_translators.includes(bcp)
  }

  let requested = $state<Record<string, boolean>>({})
  let show_login = $state(false)
  let pending = $state<{ bcp: string, name: string } | null>(null)

  async function start_volunteer(bcp: string, name: string) {
    if (!auth_user.user) {
      pending = { bcp, name }
      show_login = true
      return
    }
    await send_volunteer(bcp, name)
  }

  // After a logged-out user signs in via the LoginModal, auto-send the request they intended.
  $effect(() => {
    if (auth_user.user && pending) {
      const intended = pending
      pending = null
      void send_volunteer(intended.bcp, intended.name)
    }
  })

  async function send_volunteer(bcp: string, name: string) {
    const { user } = auth_user
    if (!user)
      return
    const { error } = await api_contact({
      name: user.name || 'Anonymous',
      email: user.email ?? '',
      message: `${user.name || user.email} would like to help review the ${name} (${bcp}) interface translation.`,
      url: window.location.href,
      subject: `${t('contact.translate_volunteer')} — ${name} (${bcp})`,
      subject_key: 'translate_volunteer',
    })
    if (error) {
      toast.error(t('header.volunteer_failed'))
      return
    }
    requested[bcp] = true
    toast.success(t('header.volunteer_sent', { values: { language: name } }))
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span>{t('header.select_language')}</span>
  {/snippet}

  <div class="locale-list">
    {#each locales as [bcp, name] (bcp)}
      <div class={['locale-row', { active: locale.includes(bcp) }]}>
        <HeadlessButton
          class="{locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-switch"
          onclick={() => changeLocale(bcp)}>
          {name}
        </HeadlessButton>
        {#if needs_reviewer(bcp)}
          {#if requested[bcp]}
            <span class="requested"><IconCheck /> {t('header.needs_reviewer')}</span>
          {:else}
            <HeadlessButton
              class="btn-ghost btn-sm volunteer-btn"
              title={t('header.needs_reviewer')}
              onclick={() => start_volunteer(bcp, name)}>
              <IconHandHeart /> {t('header.volunteer_to_review')}
            </HeadlessButton>
          {/if}
        {/if}
      </div>
    {/each}

    {#if auth_user.is_admin}
      {#each unpublishedLocales as [bcp, name] (bcp)}
        <div class={['locale-row', { active: locale.includes(bcp) }]}>
          <HeadlessButton
            class="{locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-switch"
            onclick={() => changeLocale(bcp)}>
            {name}
            <IconKey />
          </HeadlessButton>
        </div>
      {/each}
    {/if}
  </div>
</Modal>

{#if show_login}
  <LoginModal on_close={() => (show_login = false)} />
{/if}

<style>
  .locale-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .locale-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.5rem;
    padding: 0.125rem;
  }

  .locale-row.active {
    background: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  .locale-list :global(.locale-switch) {
    text-transform: none !important;
    justify-content: flex-start;
    flex: 1;
    min-width: 0;
  }

  .locale-list :global(.volunteer-btn) {
    text-transform: none !important;
    color: var(--primary);
    white-space: nowrap;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .requested {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
    white-space: nowrap;
    flex-shrink: 0;
    padding-right: 0.5rem;
  }
</style>
