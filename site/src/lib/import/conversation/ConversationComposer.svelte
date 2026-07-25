<script lang="ts">
  import IconFa6SolidPaperPlane from '~icons/fa6-solid/paper-plane'
  import { page } from '$app/state'
  import { api_conversation_post_message } from '$api/v1/dictionaries/[id]/conversations/_call'
  import { toast } from '$lib/state/toast.svelte'

  interface Props {
    dictionary_id: string
    thread_id: string
    on_sent: () => void
  }
  const { dictionary_id, thread_id, on_sent }: Props = $props()
  const { t } = $derived(page.data)

  let body_text = $state('')
  let sending = $state(false)

  async function send() {
    const text = body_text.trim()
    if (!text || sending)
      return
    sending = true
    const { error } = await api_conversation_post_message({ dictionary_id, thread_id, body_text: text })
    sending = false
    if (error) {
      toast.error(error.message)
      return
    }
    body_text = ''
    on_sent()
  }
</script>

<div class="composer">
  <textarea
    rows="2"
    bind:value={body_text}
    placeholder={t('import_page.write_message')}
    onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send() }}></textarea>
  <div class="row">
    <span class="hint">{t('import_page.reply_on_site_note')}</span>
    <button type="button" class="btn-primary btn-default" disabled={sending || !body_text.trim()} onclick={send}>
      <IconFa6SolidPaperPlane style="margin-right: 0.4rem" />
      {sending ? t('import_page.sending') : t('import_page.send')}
    </button>
  </div>
</div>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    padding-top: 0.85rem;
  }
  textarea {
    width: 100%;
    resize: vertical;
    font-size: 0.9rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .hint {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
</style>
