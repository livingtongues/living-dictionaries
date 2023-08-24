/* eslint-disable no-undef */
const defaultHeaders: RequestInit['headers'] = {
  'content-type': 'application/json',
};

export function apiFetch<T extends Record<string, any>>(route: string, data: T, headers: RequestInit['headers'] = defaultHeaders) {
  return fetch(route, {
    method: 'POST',
    body: JSON.stringify(data),
    headers,
  });
}
