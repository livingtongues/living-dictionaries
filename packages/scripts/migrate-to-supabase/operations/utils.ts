const uuid_template = '11111111-1111-1111-1111-111111111111'
let current_uuid_index = 0

export function incremental_consistent_uuid() {
  return uuid_template.slice(0, -2) + (current_uuid_index++).toString().padStart(2, '0')
}
