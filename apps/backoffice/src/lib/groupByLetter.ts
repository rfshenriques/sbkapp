export const NUMERIC_BUCKET_KEY = '0-9';

export interface LetterGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * A-Z each get their own bucket; a name starting with a digit (e.g. "1899
 * Hoffenheim") falls into one combined numbers bucket rather than a
 * separate bucket per digit. Shared by Team Colors and the Display Names
 * Teams tab, the two admin pages that group a flat team list this way.
 */
export function groupByLetter<T>(items: T[], nameOf: (item: T) => string): LetterGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const firstChar = nameOf(item).trim().charAt(0).toUpperCase();
    const key = /[0-9]/.test(firstChar) ? NUMERIC_BUCKET_KEY : firstChar || '#';
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return Array.from(map.entries())
    .map(([key, bucket]) => ({ key, label: key, items: bucket }))
    .sort((a, b) => {
      if (a.key === NUMERIC_BUCKET_KEY) return 1;
      if (b.key === NUMERIC_BUCKET_KEY) return -1;
      return a.key.localeCompare(b.key);
    });
}
