<script>import { createEventDispatcher } from "svelte";
const dispatch = createEventDispatcher();
import { readable } from "svelte/store";
export let input;
let set;
$:
  if (input) {
    update(input);
  } else {
    update([]);
  }
$:
  array = readable(Array.from(set) || null);
function update(newSet) {
  set = new Set(newSet);
}
function add(item) {
  set.add(item);
  set = set;
  dispatch("modified", Array.from(set));
}
function remove(item) {
  set.delete(item);
  set = set;
  dispatch("modified", Array.from(set));
}
</script>

<slot value={$array} {add} {update} {remove} size={set.size} />
