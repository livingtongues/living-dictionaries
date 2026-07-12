<script lang="ts">
  import type { EntryFieldValue } from '$lib/types'
  import sanitize from 'xss'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text } from '$lib/markdown/sanitize-rich-text'
  import IconFa6SolidPencil from '~icons/fa6-solid/pencil'

  interface Props {
    value: string
    field: EntryFieldValue
    bcp?: string
    display: string
    can_edit?: boolean
    on_update: (new_value: string) => void
    class?: string
  }

  const { value, field, bcp = undefined, display, can_edit = false, on_update, class: klass = '' }: Props = $props()
</script>

{#if value || can_edit}
  <ShowHide>
    {#snippet children({ show, set, toggle })}
      <div
        class="field-block {klass}"
        onclick={() => set(can_edit)}
        class:editable={can_edit}
        class:at-end={!value}>
        {#if field !== 'lexeme'}
          <div class="field-label">{display}</div>
        {/if}
        <!-- The headword is the page's h1 (SEO: primary keyword needs heading weight).
          Pixel-identical to the old div: the Tailwind reset zeroes h1 margins and
          inherits font-size/weight, then .headword applies the same styles as before. -->
        <svelte:element
          this={field === 'lexeme' ? 'h1' : 'div'}
          class:sompeng={display === 'Sompeng'}
          class:headword={field === 'lexeme'}
          class:underlined={field !== 'lexeme'}
          class="field-value">
          {#if value}
            <div dir="ltr">
              {#if field === 'notes'}
                <span class="tw-prose">
                  {@html sanitize_rich_text(render_markdown_to_html(value))}
                </span>
              {:else if value.includes('<i>')}
                <span class="tw-prose">
                  {@html sanitize(value)}
                </span>
              {:else if field === 'phonetic'}
                [{value}]
              {:else if field === 'scientific_names' && !value?.includes('<i>')}
                <i>{value}</i>
              {:else}
                {value}
              {/if}
            </div>
          {:else}<IconFa6SolidPencil style="opacity: 0.4; font-size: 0.875rem" />{/if}
        </svelte:element>
      </div>
      {#if show}
        {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
          <EditFieldModal {on_update} {value} {field} {display} {bcp} on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
{/if}

<style>
  .field-block {
    border-radius: 0.25rem;
  }

  @media (min-width: 768px) {
    .field-block {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
  }

  .editable {
    cursor: pointer;
  }

  .editable:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  .at-end {
    order: 2;
  }

  .field-label {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary); /* ≈ gray-500 */
    margin-top: 0.25rem;
  }

  .field-value {
    border-style: dashed;
    padding-bottom: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .headword {
    font-weight: 700;
    font-size: 2.25rem;
    line-height: 2.5rem;
  }

  .underlined {
    border-bottom-width: 2px;
  }
</style>
