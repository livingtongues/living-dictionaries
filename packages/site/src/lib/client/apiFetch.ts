export function apiFetch<T extends Record<string, any>>(route: string, data: T) {
  return fetch(route, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
    },
  });
}