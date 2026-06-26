<script lang="ts">
  export let show: string | boolean = false;
  function toggle() {
    show = !show;
  }
  function set(value: string | boolean) {
    show = value;
  }
</script>

<slot {show} {toggle} {set} />

