// Shared cursor letting the edit modal's "Save ↓" action run down a table column: the closing
// cell requests the next row's cell id and that cell's Textbox auto-opens its editor.
let target = $state<string | null>(null)

export const column_run = {
  get target() {
    return target
  },
  request(cell_id: string) {
    target = cell_id
    // Safety valve: if no rendered cell claims the id (e.g. the run hit a striped
    // needs-sentence-first cell), drop it so it can't fire a modal later.
    setTimeout(() => {
      if (target === cell_id) target = null
    }, 1000)
  },
  consume() {
    target = null
  },
}
