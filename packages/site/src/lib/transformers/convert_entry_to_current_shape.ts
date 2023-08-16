import type { ActualDatabaseEntry, GoalDatabaseEntry, DatabaseSense } from "@living-dictionaries/types";
import type { ActualDatabaseVideo } from "@living-dictionaries/types/video.interface";
import { convert_photo_file_to_current_shape } from "./convert_photo_file_to_current_shape";
import { convert_sound_file_to_current_shape } from "./convert_sound_file_to_current_shape";
import { convert_video_file_to_current_shape } from "./convert_video_file_to_current_shape";

export function convert_entry_to_current_shape(actual: ActualDatabaseEntry): GoalDatabaseEntry {
  const goal: GoalDatabaseEntry = {};
  const first_sense_from_base: DatabaseSense = {};
  for (const [key, value] of Object.entries(actual) as [keyof ActualDatabaseEntry, any][]) {
    if (!value) continue;

    if (key === 'lo') {
      goal.lo1 = value;
      continue;
    }
    if (key === 'sf') {
      if (!actual.sfs?.[0]) {
        const sound_file = convert_sound_file_to_current_shape(value);
        goal.sfs = [sound_file];
      }
      continue;
    }
    if (key === 'di' && typeof value === 'string') {
      goal.di = [value]
      continue;
    }
    if (key === 'sr' && typeof value === 'string') {
      goal.sr = [value]
      continue;
    }

    // Sense related fields
    if (['gl', 'sd', 'sdn', 'nc', 'de'].includes(key)) {
      first_sense_from_base[key] = value;
      continue;
    }
    if (key === 'vfs') {
      const unconverted_video_files = value as ActualDatabaseVideo[];
      const video_files = unconverted_video_files.map(convert_video_file_to_current_shape);
      first_sense_from_base.vfs = video_files;
      continue;
    }
    if (key === 'pf') {
      const photo_file = convert_photo_file_to_current_shape(value);
      first_sense_from_base.pfs = [photo_file];
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
    goal.sn = [first_sense_from_base, ...(actual.sn || [])];
  }
  return goal;
}
