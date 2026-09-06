/** Normalize DB image array + optional legacy single URL column. */
export function normalizeImageUrls(
  urls: string[] | null | undefined,
  legacyUrl?: string | null,
): string[] {
  if (Array.isArray(urls) && urls.length > 0) {
    return urls.filter((u) => typeof u === 'string' && u.trim() !== '');
  }
  if (legacyUrl && legacyUrl.trim()) return [legacyUrl.trim()];
  return [];
}

export const MAX_ENTITY_IMAGES = 10;
