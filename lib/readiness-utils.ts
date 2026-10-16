export function statusForScore(score: number): string {
  if (score >= 75) return 'Good';
  if (score >= 65) return 'Needs work';
  return 'Needs attention';
}

/** Fetches JSON from a same-origin API route, falling back to mock data if it hasn't been posted to yet or fails. */
export async function fetchJsonWithFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} responded ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
