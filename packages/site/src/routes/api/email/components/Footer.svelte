<script lang="ts">
  import type { ComponentProps } from 'svelte'
  // import Link from './Link.svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<typeof Row>
    brand: string
    href: string
    address: string
    // show_unsubscribe?: boolean
    reason_for_email?: string
  }

  let {
    row = {},
    brand,
    href,
    address,
    // show_unsubscribe = true,
    reason_for_email = undefined,
  }: Props = $props()
</script>

<Row {...row}>
  <td>
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tbody>
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
            <!-- {#if show_unsubscribe}
              Log in and go to your
              <Link color="#555555" href="https://livingdictionaries.app/account">Account Settings</Link>
              and uncheck "Recieve newsletter updates" to unsubscribe.
            {/if} -->
          </td>
        </tr>
      </tbody>
    </table>
  </td>
</Row>
