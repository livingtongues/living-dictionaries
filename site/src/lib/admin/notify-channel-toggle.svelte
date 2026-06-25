<script lang="ts">
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Sync } from '$lib/db/sync/engine.svelte'
  import type { NotifyChannel } from '$api/admin/set-notify-channel/+server'
  import { api_admin_set_notify_channel } from '$api/admin/set-notify-channel/_call'
  import IconMdiBellRingOutline from '~icons/mdi/bell-ring-outline'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiEmailOutline from '~icons/mdi/email-outline'

  interface Props {
    db: LiveDb | null
    sync: Sync | null
    user_id: string
  }
  let { db, sync, user_id }: Props = $props()

  const channel = $derived<NotifyChannel>(
    (db?.users.id(user_id)?.notify_channel as NotifyChannel | undefined) ?? 'email',
  )

  let saving = $state<NotifyChannel | null>(null)
  let error_message = $state<string>()

  async function choose(next: NotifyChannel) {
    if (next === channel || saving)
      return
    saving = next
    error_message = undefined
    const { error } = await api_admin_set_notify_channel({ channel: next })
    if (error)
      error_message = error.message
    else
      await sync?.sync()
    saving = null
  }
</script>

<div class="channel">
  <span class="channel-label">Where should we send your notifications?</span>
  <div class="channel-options" role="group" aria-label="Notification channel">
    <button
      type="button"
      class={['channel-btn', { active: channel === 'email' }]}
      disabled={!!saving}
      aria-pressed={channel === 'email'}
      onclick={() => choose('email')}>
      {#if channel === 'email'}<IconMdiCheck class="channel-check" />{:else}<IconMdiEmailOutline />{/if}
      Email
    </button>
    <button
      type="button"
      class={['channel-btn', { active: channel === 'ntfy' }]}
      disabled={!!saving}
      aria-pressed={channel === 'ntfy'}
      onclick={() => choose('ntfy')}>
      {#if channel === 'ntfy'}<IconMdiCheck class="channel-check" />{:else}<IconMdiBellRingOutline />{/if}
      Phone push (ntfy)
    </button>
  </div>
  <p class="channel-help">
    {#if saving}
      Saving…
    {:else if channel === 'ntfy'}
      You're set to get instant push notifications. Make sure you've subscribed to your topic below on each device.
    {:else}
      You'll get a short email with a link back here. Subscribe to ntfy below and switch to push for instant alerts.
    {/if}
  </p>
  {#if error_message}
    <p class="channel-error">Couldn't save: {error_message}</p>
  {/if}
</div>

<style>
  .channel {
    margin-top: 1.25rem;
    padding: 1rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }
  .channel-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }
  .channel-options {
    display: inline-flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
  .channel-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--surface);
    color: var(--color-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  }
  .channel-btn:hover:not(:disabled) {
    color: var(--color);
    border-color: var(--color-secondary);
  }
  .channel-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .channel-btn.active {
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary), transparent 90%);
  }
  :global(.channel-check) {
    color: var(--primary);
  }
  .channel-help {
    font-size: 0.8rem;
    color: var(--color-secondary);
    margin-top: 0.625rem;
  }
  .channel-error {
    font-size: 0.8rem;
    color: var(--danger);
    margin-top: 0.5rem;
  }
</style>
