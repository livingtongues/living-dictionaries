<script lang="ts">
  import type { ConversationSummary } from '$api/v1/dictionaries/[id]/conversations/+server'
  import IconFa6SolidFile from '~icons/fa6-solid/file'
  import IconMdiCheckCircleOutline from '~icons/mdi/check-circle-outline'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'
  import IconMdiCommentQuestionOutline from '~icons/mdi/comment-question-outline'
  import IconMdiLockOutline from '~icons/mdi/lock-outline'
  import { page } from '$app/state'
  import { format_date_time } from '$lib/utils/format-relative-time'

  interface Props {
    conversation: ConversationSummary
    dictionary_url: string
  }
  const { conversation, dictionary_url }: Props = $props()
  const { t } = $derived(page.data)
</script>

<a class="request-card" href={`/${dictionary_url}/import/${conversation.id}`}>
  <div class="main">
    <div class="line">
      <span class="date">{format_date_time(conversation.created_at)}</span>
      {#if conversation.resolved_at}
        <span class="pill done"><IconMdiCheckCircleOutline /> {t('import_page.resolved_on')}</span>
      {:else if conversation.started_at}
        <span class="pill active">{t('import_page.in_progress')}</span>
      {:else}
        <span class="pill">{t('import_page.requested')}</span>
      {/if}
      {#if conversation.started_at}
        <span class="pill muted"><IconMdiLockOutline /> {t('import_page.locked')}</span>
      {/if}
    </div>

    <div class="line counts">
      <span><IconFa6SolidFile /> {conversation.resource_count}</span>
      {#if conversation.open_questions}
        <span class="questions">
          <IconMdiCommentQuestionOutline />
          {t('import_page.questions_heading')}: {conversation.open_questions}
        </span>
      {/if}
      {#if conversation.unread}
        <span class="unread">{conversation.unread}</span>
      {/if}
    </div>

    {#if conversation.import_request_note}
      <p class="note">{conversation.import_request_note}</p>
    {/if}
  </div>
  <span class="open">
    {t('import_page.open_conversation')}
    <IconMdiChevronRight />
  </span>
</a>

<style>
  .request-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.875rem;
    padding: 0.75rem 0.9rem;
    background: var(--surface);
    color: inherit;
  }
  .request-card:hover {
    border-color: color-mix(in srgb, var(--primary) 40%, var(--background));
  }
  .main {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .date {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .counts {
    font-size: 0.78rem;
    color: var(--color-secondary);
    gap: 0.8rem;
  }
  .counts span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .questions {
    color: var(--primary);
    font-weight: 600;
  }
  .unread {
    background: var(--primary);
    color: #fff;
    border-radius: 9999px;
    padding: 0 0.4rem;
    font-weight: 700;
    font-size: 0.7rem;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
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
  .note {
    font-size: 0.82rem;
    color: var(--color-secondary);
    line-height: 1.45;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary);
    white-space: nowrap;
  }
</style>
