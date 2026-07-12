<script lang="ts">
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'

  const { dictionary_id }: { dictionary_id: string } = $props()

  const prompt = $derived(`You can access and help me with my Living Dictionary through its API.

- API base: ${page.url.origin}/api/v1
- Full reference (fetch this first): ${page.url.origin}/api/v1/openapi.json
- Dictionary id: ${dictionary_id}
- Auth: add the header \`Authorization: Bearer <YOUR_API_KEY>\` to every request (I'll give you the key separately).

Read the reference to help me with the tasks I give you.`)

  let copied = $state(false)

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }
</script>

<div class="agent-prompt">
  <div class="prompt-head">
    <span class="prompt-title">Create an API key then hand your agent this prompt</span>
    <HeadlessButton class="btn-primary btn-sm" onclick={copy}>{copied ? 'Copied ✓' : 'Copy'}</HeadlessButton>
  </div>
  <pre class="prompt-body">{prompt}</pre>
</div>

<style>
  .agent-prompt {
    margin: 0.25rem 0 1.25rem;
  }
  .prompt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }
  .prompt-title {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .prompt-body {
    width: 100%;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    background: color-mix(in srgb, var(--color) 5%, var(--background));
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin: 0;
    overflow-x: auto;
  }
</style>
