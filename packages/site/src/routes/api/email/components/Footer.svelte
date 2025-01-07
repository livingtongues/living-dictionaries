<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Link from './Link.svelte'
  import Row from './Row.svelte'

  export let row: ComponentProps<Row> = {}
  export let brand: string
  export let href: string
  export let address: string
  export let show_unsubscribe = true
  export let reason_for_email: string = undefined
</script>

<Row {...row}>
  <td>
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
          <a style="font-weight:bold; color:#555555; text-decoration:none" target="_blank" {href}>
            {brand}
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family: Helvetica, arial, sans-serif; font-size: 13px; line-height: 21px; color: #889098;">
          {address}
        </td>
      </tr>
      <tr>
        <td width="100%" height="14"></td>
      </tr>
      <tr>
        <td align="center" style="font-family: Helvetica, arial, sans-serif; font-size: 13px; line-height: 21px; color: #555555">
          {#if reason_for_email}
            {reason_for_email}
          {/if}
          {#if show_unsubscribe}
            Log in and go to your
            <Link color="#555555" href="https://hvsb.app/account">Account Settings</Link>
            and uncheck "Recieve newsletter updates" to unsubscribe.
          {/if}
        </td>
      </tr>
    </table>
  </td>
</Row>
