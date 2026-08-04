import { SvelteMap, SvelteSet } from 'svelte/reactivity'

/**
 * Per-dictionary bulk-selection basket for the entries table. Lives at module scope
 * so it survives searching, filtering, and paging within a session — select rows,
 * search again, select more, then act on the whole basket.
 */
export class EntrySelection {
  ids = new SvelteSet<string>()
  view_selected = $state(false)

  has(id: string) {
    return this.ids.has(id)
  }

  toggle(id: string) {
    if (this.ids.has(id)) {
      this.ids.delete(id)
      if (!this.ids.size) this.view_selected = false
    } else {
      this.ids.add(id)
    }
  }

  remove(id: string) {
    this.ids.delete(id)
    if (!this.ids.size) this.view_selected = false
  }

  clear() {
    this.ids.clear()
    this.view_selected = false
  }
}

const selections = new SvelteMap<string, EntrySelection>()

export function get_entry_selection(dict_id: string): EntrySelection {
  let selection = selections.get(dict_id)
  if (!selection) {
    selection = new EntrySelection()
    selections.set(dict_id, selection)
  }
  return selection
}
