<script lang="ts">
  import type { ConversationRow } from '$lib/db/server/import-conversations'
  import IconMdiCheckCircleOutline from '~icons/mdi/check-circle-outline'
  import IconMdiClipboardTextOutline from '~icons/mdi/clipboard-text-outline'
  import IconMdiLockOutline from '~icons/mdi/lock-outline'
  import IconMdiPlayCircleOutline from '~icons/mdi/play-circle-outline'
  import { page } from '$app/state'
  import {
    api_conversation_brief,
    api_conversation_update,
    api_conversation_withdraw,
  } from '$api/v1/dictionaries/[id]/conversations/_call'
  import { goto } from '$app/navigation'
  import { toast } from '$lib/state/toast.svelte'
  import { format_date_time } from '$lib/utils/format-relative-time'

  interface Props {
    conversation: ConversationRow
    dictionary_id: string
    dictionary_url: string
    /** Site admin or agent key — unlocks start/resolve + the Copy job brief button. */
    is_team: boolean
    /** The requester (or a site admin) may withdraw, but only before we start. */
    can_withdraw: boolean
    on_changed: () => void
  }
  const { conversation, dictionary_id, dictionary_url, is_team, can_withdraw, on_changed }: Props = $props()
  const { t } = $derived(page.data)

  let busy = $state(false)

  async function set_state(body: { started?: true, resolved?: boolean }) {
    if (busy)
      return
    busy = true
    const { error } = await api_conversation_update({ dictionary_id, thread_id: conversation.id, ...body })
    busy = false
    if (error) {
      toast.error(error.message)
      return
    }
    on_changed()
  }

  async function copy_brief() {
    const { data, error } = await api_conversation_brief({ dictionary_id, thread_id: conversation.id })
    if (error || !data) {
      toast.error(error?.message ?? 'Could not build the brief')
      return
    }
    await navigator.clipboard.writeText(data.brief)
    toast.success('Job brief copied')
  }

  async function withdraw() {
    if (!confirm(t('import_page.withdraw_confirm')))
      return
    busy = true
    const { error } = await api_conversation_withdraw({ dictionary_id, thread_id: conversation.id })
    busy = false
    if (error) {
      toast.error(error.message)
      return
    }
    await goto(`/${dictionary_url}/import`)
  }
</script>

<header class="conversation-head">
  <div class="titles">
    <h3>{t('import_page.conversation')}</h3>
    <p class="dates">
      {format_date_time(conversation.created_at)}
      {#if conversation.started_at}
        · {t('import_page.started_on')} {format_date_time(conversation.started_at)}
      {/if}
    </p>
  </div>

  <div class="pills">
    {#if conversation.resolved_at}
      <span class="pill done"><IconMdiCheckCircleOutline /> {t('import_page.resolved_on')}</span>
    {:else if conversation.started_at}
      <span class="pill active">{t('import_page.in_progress')}</span>
    {:else}
      <span class="pill">{t('import_page.requested')}</span>
    {/if}
    {#if conversation.started_at}
      <span class="pill muted" title={t('import_page.locked_explanation')}>
        <IconMdiLockOutline /> {t('import_page.locked')}
      </span>
    {/if}
  </div>

  <div class="actions">
    {#if is_team}
      <button type="button" class="btn btn-sm" onclick={copy_brief}>
        <IconMdiClipboardTextOutline /> Copy job brief
      </button>
      {#if !conversation.started_at}
        <button type="button" class="btn btn-sm" disabled={busy} onclick={() => set_state({ started: true })}>
          <IconMdiPlayCircleOutline /> Start
        </button>
      {/if}
      <button type="button" class="btn btn-sm" disabled={busy} onclick={() => set_state({ resolved: !conversation.resolved_at })}>
        <IconMdiCheckCircleOutline />
        {conversation.resolved_at ? 'Reopen' : 'Resolve'}
      </button>
    {:else if can_withdraw}
      <button type="button" class="btn btn-sm" disabled={busy} onclick={withdraw}>
        {t('import_page.withdraw_request')}
      </button>
    {/if}
  </div>
</header>

<style>
  .conversation-head {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
  }
  h3 {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .dates {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.1rem;
  }
  .pills {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
    white-space: nowrap;
  }
  .pill.active {
    background: color-mix(in srgb, var(--warning), transparent 86%);
    color: var(--warning);
  }
  .pill.done {
    background: color-mix(in srgb, var(--success), transparent 86%);
    color: var(--success);
  }
  .pill.muted {
    background: color-mix(in srgb, var(--color) 8%, var(--background));
    color: var(--color-secondary);
  }
  .actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-left: auto;
  }
  .actions .btn {
    gap: 0.3rem;
  }
</style>
