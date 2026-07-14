<script lang="ts">
  import { page } from '$app/state'
  import Modal from '$lib/components/ui/Modal.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { split_text_into_sentences } from '$lib/corpus/split-text-into-sentences'
  import { key_between } from '$lib/api/v1/fractional-index'
  import { get_orthographies } from '$lib/helpers/orthographies'

  interface Props {
    text_id: string
    last_sort_key: string | null
    on_close: () => void
  }

  const { text_id, last_sort_key, on_close }: Props = $props()

  const { dictionary, dict_db } = $derived(page.data)
  const orthographies = $derived(get_orthographies(dictionary ?? {}))

  let body = $state('')
  let saving = $state(false)
  const preview = $derived(split_text_into_sentences(body))

  async function append() {
    if (saving || !preview.length) return
    saving = true
    try {
      let previous_key = last_sort_key
      const rows = preview.map((sentence) => {
        const sort_key = key_between(previous_key, null)
        previous_key = sort_key
        return {
          text: { [orthographies.primary.code]: sentence.text },
          text_id,
          sort_key,
          ...sentence.ends_paragraph ? { ends_paragraph: 1 } : {},
        }
      })
      await dict_db.sentences.insert(rows)
      on_close()
    } catch (err) {
      alert(err)
      console.error(err)
      saving = false
    }
  }
</script>

<Modal noscroll {on_close}>
  {#snippet heading()}
    <span>{page.data.t('text.append')}</span>
  {/snippet}

  <p class="hint">{page.data.t('text.append_hint')}</p>
  <textarea rows="6" bind:value={body}></textarea>
  <div class="modal-footer">
    <span class="detected">
      {#if preview.length}
        {page.data.t('text.detected', { values: { count: String(preview.length), paragraphs: String(preview.filter(sentence => sentence.ends_paragraph).length + 1) } })}
      {/if}
    </span>
    <span style="flex-grow: 1"></span>
    <HeadlessButton class="btn-primary btn-default" loading={saving} disabled={!preview.length} onclick={append}>
      {page.data.t('text.append')}
    </HeadlessButton>
  </div>
</Modal>

<style>
  .hint {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }

  textarea {
    width: 100%;
    resize: vertical;
  }

  .detected {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }
</style>
