<script lang="ts">
  import type { ConversationMessageForClient } from '$api/v1/dictionaries/[id]/conversations/[thread_id]/+server'
  import { page } from '$app/state'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    message: ConversationMessageForClient
    /** The viewer, so their own messages read as "You". */
    current_user_id: string | null | undefined
  }
  const { message, current_user_id }: Props = $props()
  const { t } = $derived(page.data)

  // Machine-generated events ("X updated the details for Y") are not anybody's
  // message — rendering them as a bubble made the manager look like they typed
  // it at themselves. They get a quiet centered line instead.
  const is_event = $derived(message.author_kind === 'system')
  const is_team = $derived(message.author.is_team)
  const is_me = $derived(!!current_user_id && message.author.user_id === current_user_id)
  const display_name = $derived(
    is_me
      ? t('import_page.you')
      : message.author.name || message.author.email || (is_team ? t('import_page.our_team') : ''),
  )
  const initials = $derived(
    (message.author.name || message.author.email || '?')
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join(''),
  )
</script>

{#if is_event}
  <div class="event">
    <p>{message.body_text}</p>
    <time datetime={message.created_at} title={format_date_time(message.created_at)}>
      {format_relative_time(message.created_at)}
    </time>
  </div>
{:else}
  <article class="message" class:team={is_team}>
    <div class="avatar" aria-hidden="true">{initials}</div>
    <div class="body">
      <div class="meta">
        <span class="name">{display_name}</span>
        {#if is_team && !is_me}
          <span class="tag">{t('import_page.our_team')}</span>
        {/if}
        <time datetime={message.created_at} title={format_date_time(message.created_at)}>
          {format_relative_time(message.created_at)}
        </time>
      </div>
      <p class="text">{message.body_text}</p>
    </div>
  </article>
{/if}

<style>
  .event {
    text-align: center;
    font-size: 0.78rem;
    color: var(--color-secondary);
    line-height: 1.5;
    padding: 0.15rem 0;
  }
  .event p {
    white-space: pre-wrap;
  }
  .event time {
    font-size: 0.72rem;
    opacity: 0.75;
  }

  .message {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
  }
  .avatar {
    flex-shrink: 0;
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
    color: #fff;
    background: color-mix(in srgb, var(--color) 45%, var(--background));
  }
  .message.team .avatar {
    background: var(--primary);
  }
  .body {
    min-width: 0;
    flex-grow: 1;
  }
  .meta {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
  }
  .name {
    font-weight: 700;
  }
  .tag {
    font-size: 0.68rem;
    padding: 0.05rem 0.4rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
    font-weight: 600;
  }
  time {
    color: var(--color-secondary);
  }
  .text {
    margin-top: 0.2rem;
    font-size: 0.9rem;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
