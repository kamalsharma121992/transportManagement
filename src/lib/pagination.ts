export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems === 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

export function getPageRange(page: number, pageSize: number, totalItems: number) {
  if (totalItems === 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return { start, end };
}

export function getSupabaseRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export function clampPage(page: number, totalItems: number, pageSize: number): number {
  const totalPages = getTotalPages(totalItems, pageSize);
  return Math.min(Math.max(page, 1), totalPages);
}
