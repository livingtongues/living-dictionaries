<script lang="ts">
  import type { ThreadQuestionRow } from '$lib/db/server/import-conversations'
  import { page } from '$app/state'
  import QuestionCard from './QuestionCard.svelte'

  interface Props {
    questions: ThreadQuestionRow[]
    dictionary_id: string
    thread_id: string
    report_artifact_id: string | null
    on_answered: () => void
  }
  const { questions, dictionary_id, thread_id, report_artifact_id, on_answered }: Props = $props()
  const { t } = $derived(page.data)

  const answered = $derived(questions.filter(question => question.status === 'answered').length)
</script>

<section class="questions">
  <header>
    <h4>{t('import_page.questions_heading')}</h4>
    <span class="progress">{t('import_page.questions_progress', { values: { answered: String(answered), total: String(questions.length) } })}</span>
  </header>
  <p class="intro">{t('import_page.questions_intro')}</p>
  <ol>
    {#each questions as question, index (question.id)}
      <QuestionCard
        {question}
        position={index + 1}
        {dictionary_id}
        {thread_id}
        {report_artifact_id}
        {on_answered} />
    {/each}
  </ol>
</section>

<style>
  .questions {
    border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--background));
    background: color-mix(in srgb, var(--primary), transparent 96%);
    border-radius: 0.875rem;
    padding: 0.85rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  h4 {
    font-weight: 700;
    font-size: 0.95rem;
  }
  .progress {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary);
  }
  .intro {
    font-size: 0.8rem;
    color: var(--color-secondary);
    line-height: 1.5;
  }
  ol {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
  }
</style>
