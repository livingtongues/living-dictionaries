<script lang="ts">
  export let href: string
  export let color: string
</script>

<a style="color: {color}" target="_blank" {href}><slot /></a>
