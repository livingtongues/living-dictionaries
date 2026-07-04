<script lang="ts">
  import IconMdiMessageOutline from '~icons/mdi/message-outline'
  import IconFa6SolidRobot from '~icons/fa6-solid/robot'
  import ShowHide from '$lib/components/ui/LegacyShowHide.svelte'
  import { page } from '$app/state'

  const { data } = $props()
  const { dictionary } = $derived(data)
</script>

<div class="import-page">
  <h3 class="import-heading">
    {page.data.t('import_page.import')}
  </h3>

  <div class="agent-callout">
    <IconFa6SolidRobot class="icon-inline" style="font-size: 1.1rem; flex-shrink: 0; margin-top: 0.15rem" />
    <p>
      <strong>Want it done faster?</strong> If you're comfortable with an AI coding agent (like Claude
      or ChatGPT), skip the wait — create an API key on the <a href={`/${dictionary.url}/agents`}>Agents</a>
      page and have it read your file and import the data directly through our API.
    </p>
  </div>

  <p class="paragraph">
    {page.data.t('import_page.instructions_1')}
  </p>
  <ol class="steps">
    <li>{page.data.t('import_page.instructions_2')}</li>
    <li>{page.data.t('import_page.instructions_3')}</li>
  </ol>
  <p class="paragraph">
    {page.data.t('import_page.instructions_4')}
  </p>

  <div class="actions">
    <a class="btn-primary btn-default" target="_blank" rel="noopener noreferrer" href="https://docs.google.com/spreadsheets/d/1Bqy1q_XZzlZLDM_glTxQ9gw0Pb5JEUssqQFtINxbwzY/edit#gid=1392642957">
      {page.data.t('import_page.template_link')}
    </a>
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button type="button" class="btn btn-default" style="gap: 0.4rem" onclick={toggle}>
          <IconMdiMessageOutline />
          {page.data.t('header.contact_us')}
        </button>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact subject="import_data" on:close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>
  </div>
</div>

<style>
  .import-page {
    max-width: 768px;
  }

  .import-heading {
    margin-bottom: 1rem;
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    color: var(--color);
  }

  .agent-callout {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
  }

  .agent-callout a {
    color: var(--primary);
    text-decoration: underline;
  }

  .paragraph {
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }

  .steps {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .steps li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    margin-top: 1.25rem;
  }
</style>
