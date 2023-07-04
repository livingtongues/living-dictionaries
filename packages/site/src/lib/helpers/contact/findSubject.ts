import { subjects } from '$lib/mappings/email-subjects';

export function findSubject(subject_key: string): string {
  return subjects.find(sbj => sbj.keyName === subject_key).title
}