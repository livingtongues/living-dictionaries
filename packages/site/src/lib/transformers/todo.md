Together:
~~- write apply_convert_expand_entry function that applies convert_entry_to_current_shape and expand_entry to incoming entries using spread operation to keep old shape~~
 
- Add to entry/+page.ts and entry/+page.svelte updates
- gallery, list, print, table:
  - update Hits component with apply_convert_expand_entry
  - use @const with apply_convert_expand_entry to update shape of data that comes out of <Doc>

Check that dialects display can handle string or string[]

Extra: clean up parseVideoData tests