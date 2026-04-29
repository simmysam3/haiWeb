export class FetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new FetchError(res.status, `Request to ${url} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
