<script lang="ts">
  import AgentPrompt from '$lib/components/settings/AgentPrompt.svelte'
  import ApiKeys from '$lib/components/settings/ApiKeys.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { API_UNAVAILABLE_MESSAGE, is_api_unavailable_bucket } from '$lib/constants'

  const { data } = $props()
  const { dictionary, is_manager } = $derived(data)
  const api_unavailable = $derived(is_api_unavailable_bucket(dictionary.bucket))
</script>

<div class="agents-page">
  <h3 class="agents-heading">Agents</h3>
  <p class="agents-sub">Use your AI Agent to read & write this dictionary on your behalf. This is for those who know how to use an agent harness like Claude Code, Codex, Grok Code, Pi, OpenCode, Claude Cowork, GitHub Copilot, etc...</p>

  {#if api_unavailable}
    <p class="api-unavailable">{API_UNAVAILABLE_MESSAGE}</p>
  {:else if is_manager}
    <div class="explainer">
      <AgentPrompt dictionary_id={dictionary.id} />
      <p class="muted-note">
        Every change an agent makes is recorded in this dictionary's
        <a href={`/${dictionary.url}/history`}>History</a> — attributed to the agent and to the
        person whose key it used.
      </p>
    </div>

    <ApiKeys dictionary_id={dictionary.id} can_manage={is_manager} />
  {:else}
    <p class="no-access">You don't have access to this dictionary's agents.</p>
  {/if}
</div>

<SeoMetaTags
  norobots
  title="Agents"
  dictionaryName={dictionary.name}
  description="Manage AI agent access for this Living Dictionary." />

<style>
  .agents-page {
    max-width: 768px;
  }
  .agents-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .agents-sub {
    color: var(--color-secondary);
    margin: 0 0 1rem;
  }
  .explainer {
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 1.25rem;
    color: color-mix(in srgb, var(--color) 80%, var(--background));
  }
  .explainer a {
    text-decoration: underline;
  }
  .muted-note {
    font-size: 0.82rem;
    color: var(--color-secondary);
    margin-top: 0.5rem;
  }
  .no-access {
    color: var(--color-secondary);
    padding: 1rem 0;
  }
  .api-unavailable {
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    border-radius: 0.5rem;
    padding: 1rem;
    line-height: 1.5;
  }
</style>
