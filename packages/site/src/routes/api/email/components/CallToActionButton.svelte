<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<typeof Row>
    backgroundColor: string
    href: string
    children?: import('svelte').Snippet
  }

  let {
    row = {},
    backgroundColor,
    href,
    children,
  }: Props = $props()
</script>

<Row {...row}>
  <td align="center">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tbody>
        <tr>
          <td align="center">
            <table border="0" cellspacing="0" cellpadding="0" class="mobile-button-container">
              <tbody>
                <tr>
                  <td align="center" style="border-radius: 3px;" bgcolor={backgroundColor}>
                    <a target="_blank" {href} style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; padding: 15px 25px; border: 1px solid {backgroundColor}; display: inline-block;" class="mobile-button">
                      {@render children?.()}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </td>
</Row>

<style>
  @media screen and (max-width: 525px) {
    :global(.mobile-button-container) {
      margin: 0 auto;
      width: 100% !important;
    }

    :global(.mobile-button) {
      padding: 15px !important;
      border: 0 !important;
      font-size: 16px !important;
      display: block !important;
    }
  }
</style>

<svelte:options css="injected" />
