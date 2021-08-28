import type { IDictionary } from '$lib/interfaces';
import { FireStoreParser } from '$sveltefire/RESTParser';
import { firebaseConfig } from '$sveltefire/config';

export async function fetchDictionaries(): Promise<IDictionary[]> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            where: {
              compositeFilter: {
                filters: [
                  {
                    fieldFilter: {
                      field: {
                        fieldPath: 'public',
                      },
                      op: 'EQUAL',
                      value: {
                        booleanValue: true,
                      },
                    },
                  },
                ],
                op: 'AND',
              },
            },
            orderBy: [
              {
                field: {
                  fieldPath: 'name',
                },
              },
            ],
            from: [
              {
                collectionId: 'dictionaries',
              },
            ],
          },
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
    const json = await res.json();
    return json.map((doc: { document: { fields: Record<string, unknown>; name: string } }) => {
      const data = FireStoreParser<IDictionary>(doc.document.fields);
      data.id = doc.document.name.split('/').pop();
      return data;
    });
  } catch (err) {
    throw new Error(err);
  }
}
