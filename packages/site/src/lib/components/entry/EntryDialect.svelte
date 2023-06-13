<script lang="ts">
  import { BadgeArrayEmit, ShowHide, ReactiveSet } from 'svelte-pieces';
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';

  export let dialects: string[] = [];
  export let canEdit = false;

  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: 'di';
      newValue: string[];
    };
  }>();
</script>

{#if canEdit}
  <ReactiveSet
    input={dialects}
    let:value={editedDialects}
    let:add
    let:remove
    on:modified={({ detail: newValue }) => {
      dispatch('valueupdate', {
        field: 'di',
        newValue,
      });
    }}
  >
    <ShowHide let:show let:toggle>
      <BadgeArrayEmit
        strings={editedDialects}
        addMessage={$t('misc.add', { default: 'Add' })}
        canEdit
        on:itemremoved={({ detail: { index } }) => {
          remove(editedDialects[index]);
        }}
        on:additem={toggle}
      />
      {#if show}
        {#await import('$lib/components/modals/DialectModal.svelte') then { default: DialectModal }}
          <DialectModal on:selected={(e) => {
            add(e.detail);
          }} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </ReactiveSet>
{:else}
  <BadgeArrayEmit strings={dialects} />
{/if}

