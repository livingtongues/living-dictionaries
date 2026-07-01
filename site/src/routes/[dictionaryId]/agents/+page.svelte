<script lang="ts">
  import AgentPrompt from '$lib/components/settings/AgentPrompt.svelte'
  import ApiKeys from '$lib/components/settings/ApiKeys.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import IconFa6SolidRobot from '~icons/fa6-solid/robot'

  const { data } = $props()
  const { dictionary, is_manager, is_editor_or_above } = $derived(data)
</script>

<div class="agents-page">
  <div class="page-head">
    <div class="head-icon">
      <IconFa6SolidRobot class="icon-inline" style="font-size: 1.25rem" />
    </div>
    <div>
      <h3 class="agents-heading">Agents</h3>
      <p class="agents-sub">Let an AI agent read &amp; write this dictionary on your behalf.</p>
    </div>
  </div>

  {#if is_editor_or_above}
    <div class="explainer">
      <p>
        An agent can do anything a read &amp; write key allows — add and edit entries, senses,
        glosses, example sentences, dialects and tags — in bulk, programmatically. Create an API key
        below, then hand your agent this prompt:
      </p>
      <AgentPrompt dictionary_id={dictionary.id} />
      <p class="muted-note">
        Every change an agent makes is recorded in this dictionary's
        <a href={`/${dictionary.url}/history`}>History</a> — attributed to the agent and to the
        person whose key it used.
      </p>
    </div>

    <ApiKeys dictionary_id={dictionary.id} can_manage={is_manager} />

    {#if !is_manager}
      <p class="readonly-note">
        Only dictionary managers can create or revoke keys. You can see which agents are active here.
      </p>
    {/if}
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
    padding: 12px 16px 64px;
  }
  .page-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 8px 0 12px;
  }
  .head-icon {
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: color-mix(in srgb, var(--background), var(--color) 8%);
    color: var(--color-secondary);
  }
  .agents-heading {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .agents-sub {
    color: var(--color-secondary, #6b7280);
    font-size: 14px;
    margin: 2px 0 0;
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
  .readonly-note {
    font-size: 0.82rem;
    color: var(--color-secondary);
    margin-top: 0.5rem;
  }
  .no-access {
    color: var(--color-secondary);
    padding: 1rem 0;
  }
</style>
