<script lang="ts">
  import IconMdiMessageOutline from '~icons/mdi/message-outline'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  const { data } = $props()
  const { dictionary } = $derived(data)
</script>

<div class="import-page">
  <h3 class="import-heading">
    {page.data.t('import_page.import')}: {dictionary.name}
  </h3>

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
