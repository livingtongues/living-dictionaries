import type { ActualDatabaseEntry, GoalDatabaseEntry, DatabaseSense } from "@living-dictionaries/types";

export function convert_entry_to_current_shape(actual: ActualDatabaseEntry): GoalDatabaseEntry {
  const goal: GoalDatabaseEntry = {};
  const first_sense_from_base: DatabaseSense = {};
  for (const [key, value] of Object.entries(actual) as [keyof ActualDatabaseEntry, any][]) {
    if (key === 'lo') {
      goal.lo1 = value;
      continue;
    }
    if (key === 'sf') {
      // TODO first convert to new format
      goal.sfs = [value];
      continue;
    }

    // Sense related fields
    if (['gl', 'sd', 'sdn', 'nc', 'de'].includes(key)) {
      first_sense_from_base[key] = value;
      continue;
    }
    if (key === 'vfs') {
      // TODO first convert speakerId to string[]
      first_sense_from_base.vfs = value;
      continue;
    }
    if (key === 'pf') {
      // TODO first convert to new format
      first_sense_from_base.pfs = [value];
      continue;
    }
    if (key === 'ps') {
      if (typeof value === 'string') {
        first_sense_from_base.ps = [value];
      } else {
        first_sense_from_base.ps = value;
      }
      continue;
    }
    if (key === 'xs') {
      first_sense_from_base.xs = [value];
      continue;
    }
    if (key === 'xv') {
      first_sense_from_base.xs = [{ ...first_sense_from_base.xs?.[0], vn: value }];
      continue;
    }

    // Metadata
    if (key === 'ab') {
      goal.cb = value;
      continue;
    }
    if (key === 'createdBy') {
      goal.cb = value;
      continue;
    }
    if (key === 'updatedBy') {
      goal.ub = value;
      continue;
    }
    if (key === 'createdAt') {
      goal.ca = value;
      continue;
    }
    if (key === 'updatedAt') {
      goal.ua = value;
      continue;
    }

    goal[key] = value;
  }
  if (Object.keys(first_sense_from_base).length > 0) {
    goal.sn = [first_sense_from_base, ...actual.sn ?? []];
  }
  return goal;
}
