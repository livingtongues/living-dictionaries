<script lang="ts">

  interface Props {
    src: string
  }

  let { src }: Props = $props()
</script>

<img
  {src}
  style="visibility: hidden !important;
    display: block !important;
    height:1px !important;
    width:1px !important;
    border: 0 !important;
    margin: 0 !important;
    padding: 0 !important"
  width="1"
  height="1"
  alt="" />
