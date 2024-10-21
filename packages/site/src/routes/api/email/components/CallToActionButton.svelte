<script lang="ts">
  // @ts-nocheck
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  export let row: ComponentProps<Row> = {}
  export let backgroundColor: string
  export let href: string
</script>

<Row {...row}>
  <td align="center">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table border="0" cellspacing="0" cellpadding="0" class="mobile-button-container">
            <tr>
              <td align="center" style="border-radius: 3px;" bgcolor={backgroundColor}>
                <a target="_blank" {href} style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; padding: 15px 25px; border: 1px solid {backgroundColor}; display: inline-block;" class="mobile-button">
                  <slot />
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</Row>

<style>
  @media screen and (max-width: 525px) {
    .mobile-button-container {
      margin: 0 auto;
      width: 100% !important;
    }

    .mobile-button {
      padding: 15px !important;
      border: 0 !important;
      font-size: 16px !important;
      display: block !important;
    }
  }
</style>
