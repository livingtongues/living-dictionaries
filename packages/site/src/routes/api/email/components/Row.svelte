<script lang="ts">
  interface Props {
    backgroundColor?: string
    space?: number
    top?: any
    bottom?: any
    x_padding?: number
    children?: import('svelte').Snippet
  }

  let {
    backgroundColor = '#ffffff',
    space = 0,
    top = space,
    bottom = space,
    x_padding = 12,
    children,
  }: Props = $props()
</script>

<tbody>
  <tr>
    <td bgcolor={backgroundColor} align="center" style="padding: {top}px {x_padding}px {bottom}px;">
      {@html `<!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="500"><tr><td align="center" valign="top" width="500"><![endif]-->`}
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;" class="make-responsive-on-small-screens">
        <tbody>
          <tr>
            {@render children?.()}
          </tr>
        </tbody>
      </table>
      {@html `<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->`}
    </td>
  </tr>
</tbody>

<style>
  /* 500 width + 12 padding-left + 12 padding-left + 1px to spare = 525px */
  @media screen and (max-width: 525px) {
    :global(.make-responsive-on-small-screens) {
      width: 100% !important;
    }
  }
</style>

<svelte:options css="injected" />
