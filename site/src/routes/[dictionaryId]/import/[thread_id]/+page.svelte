<script lang="ts">
  import type { V1ConversationGetResponseBody } from '$api/v1/dictionaries/[id]/conversations/[thread_id]/+server'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconFa6SolidFile from '~icons/fa6-solid/file'
  import { page } from '$app/state'
  import { api_conversation_get, api_conversation_mark_read } from '$api/v1/dictionaries/[id]/conversations/_call'
  import ArtifactBlock from '$lib/import/conversation/ArtifactBlock.svelte'
  import ConversationComposer from '$lib/import/conversation/ConversationComposer.svelte'
  import ConversationHeader from '$lib/import/conversation/ConversationHeader.svelte'
  import ConversationMessage from '$lib/import/conversation/ConversationMessage.svelte'
  import QuestionList from '$lib/import/conversation/QuestionList.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { toast } from '$lib/state/toast.svelte'

  const { data } = $props()
  const { dictionary, is_manager } = $derived(data)
  const { t } = $derived(page.data)
  const thread_id = $derived(page.params.thread_id as string)
  const current_user_id = $derived(data.auth_user?.user?.id ?? null)

  let loaded = $state<V1ConversationGetResponseBody | null>(null)
  let loading = $state(true)

  async function refresh() {
    const { data: fetched, error } = await api_conversation_get({ dictionary_id: dictionary.id, thread_id })
    loading = false
    if (error) {
      if (error.status !== 401 && error.status !== 403 && error.status !== 404)
        toast.error(error.message)
      return
    }
    loaded = fetched
  }

  $effect(() => {
    if (!is_manager)
      return
    void (async () => {
      await refresh()
      // Marking read also advances the notification batch for team members, so
      // the next manager post announces itself in the Notifications room again.
      await api_conversation_mark_read({ dictionary_id: dictionary.id, thread_id })
    })()
  })

  const report_artifacts = $derived(loaded?.artifacts.filter(artifact => artifact.kind === 'report') ?? [])
  const report_artifact_id = $derived(report_artifacts.length ? report_artifacts[report_artifacts.length - 1].id : null)
  const can_withdraw = $derived(
    !!loaded && !loaded.conversation.started_at && loaded.conversation.from_user_id === current_user_id,
  )
</script>

<div class="conversation-page">
  <a class="back" href={`/${dictionary.url}/import`}>
    <IconMdiArrowLeft />
    {t('import_page.back_to_import')}
  </a>

  {#if !is_manager}
    <p class="managers-only">{t('import_page.managers_only')}</p>
  {:else if loading}
    <p class="muted">…</p>
  {:else if !loaded}
    <p class="muted">{t('import_page.conversation_not_found')}</p>
  {:else}
    <ConversationHeader
      conversation={loaded.conversation}
      dictionary_id={dictionary.id}
      dictionary_url={dictionary.url}
      is_team={loaded.is_team}
      {can_withdraw}
      on_changed={refresh} />

    <p class="intro">{t('import_page.conversation_intro')}</p>

    {#if loaded.resources.length}
      <section class="resources">
        <h4>{t('import_page.resources_heading')}</h4>
        <ul>
          {#each loaded.resources as resource (resource.id)}
            <li>
              <a href={`/api/v1/dictionaries/${dictionary.id}/files/${resource.id}`} download={resource.filename}>
                <IconFa6SolidFile />
                {resource.filename}
              </a>
              <span class="size">{format_bytes(resource.size_bytes)}</span>
              {#if resource.import_instructions}
                <p class="instructions">{resource.import_instructions}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#each loaded.artifacts as artifact (artifact.id)}
      <ArtifactBlock {artifact} dictionary_id={dictionary.id} {thread_id} />
    {/each}

    {#if loaded.questions.length}
      <QuestionList
        questions={loaded.questions}
        dictionary_id={dictionary.id}
        {thread_id}
        {report_artifact_id}
        on_answered={refresh} />
    {/if}

    <section class="messages">
      {#each loaded.messages as message (message.id)}
        <ConversationMessage {message} {current_user_id} />
      {:else}
        <p class="muted">{t('import_page.no_conversation_messages')}</p>
      {/each}
    </section>

    <ConversationComposer dictionary_id={dictionary.id} {thread_id} on_sent={refresh} />
  {/if}
</div>

<SeoMetaTags
  norobots
  title={t('import_page.import')}
  dictionaryName={dictionary.name}
  description="An import conversation for this Living Dictionary." />

<style>
  .conversation-page {
    max-width: 768px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* The composer is the last thing on the page — without this it sits flush
       against the bottom edge of the viewport. */
    padding-bottom: 3rem;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    align-self: flex-start;
    font-size: 0.85rem;
    color: var(--color-secondary);
  }
  .back:hover {
    color: var(--primary);
  }
  .intro {
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--color-secondary);
  }
  .resources h4,
  .messages h4 {
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 0.4rem;
  }
  .resources ul {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
  }
  .resources li {
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.7rem;
    padding: 0.55rem 0.75rem;
    background: var(--surface);
  }
  .resources a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .resources a:hover {
    color: var(--primary);
  }
  .size {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-left: 0.4rem;
  }
  .instructions {
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--color-secondary);
    margin-top: 0.25rem;
    white-space: pre-wrap;
  }
  .messages {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }
  .managers-only {
    color: var(--color-secondary);
    line-height: 1.5;
  }
</style>
