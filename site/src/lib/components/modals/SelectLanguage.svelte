<script lang="ts">
  import IconKey from '~icons/fa-solid/key'
  import IconHandHeart from '~icons/mdi/hand-heart-outline'
  import IconCheck from '~icons/fa-solid/check'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import { page } from '$app/state'
  import { change_locale, locales, unpublished_locales } from '$lib/i18n/change-locale'
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

  /** The currently active published locale, if any. */
  const current = $derived(locales.find(([bcp]) => locale.includes(bcp)))

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

  <div class="locale-pills">
    {#each locales as [bcp, name] (bcp)}
      <HeadlessButton
        class="{locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-pill"
        onclick={() => change_locale(bcp)}>
        {name}
      </HeadlessButton>
    {/each}
    {#if auth_user.is_admin}
      {#each unpublished_locales as [bcp, name] (bcp)}
        <HeadlessButton
          class="{locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-pill"
          onclick={() => change_locale(bcp)}>
          {name}
          <IconKey />
        </HeadlessButton>
      {/each}
    {/if}
  </div>

  {#if current && needs_reviewer(current[0])}
    <div class="volunteer">
      {#if requested[current[0]]}
        <span class="requested"><IconCheck /> {t('header.volunteer_sent', { values: { language: current[1] } })}</span>
      {:else}
        <p>{t('header.needs_reviewer')}</p>
        <HeadlessButton
          class="btn-primary btn-sm volunteer-btn"
          onclick={() => start_volunteer(current[0], current[1])}>
          <IconHandHeart /> {t('header.volunteer_to_review')}
        </HeadlessButton>
      {/if}
    </div>
  {/if}
</Modal>

{#if show_login}
  <LoginModal on_close={() => (show_login = false)} />
{/if}

<style>
  .locale-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .locale-pills :global(.locale-pill) {
    text-transform: none !important;
  }

  .volunteer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--default-border-color);
  }

  .volunteer p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-secondary);
  }

  .volunteer :global(.volunteer-btn) {
    text-transform: none !important;
    gap: 0.25rem;
  }

  .requested {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
  }
</style>
