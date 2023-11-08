export interface Change {
  updatedBy: string;
  updatedName: string;
  entryId: string;
  entryName: string;
  dictionaryId: string;
  dictionaryName: string;
  previousValue: string | string[];
  currentValue: string | string[];
  field: string;
  updatedAtMs: number;
}
