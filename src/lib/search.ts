/** Escape special characters for PostgREST ilike patterns */
export function escapeIlike(term: string): string {
  return term
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '""')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/** Sanitize user input for PostgREST `.or()` filters (comma is a separator) */
export function sanitizeSearchTerm(term: string): string {
  return term.trim().replace(/,/g, ' ');
}

/** Build a PostgREST `.or()` filter string for case-insensitive search across columns */
export function buildTextSearchFilter(columns: string[], term: string): string | null {
  const trimmed = sanitizeSearchTerm(term);
  if (!trimmed) return null;
  const pattern = `%${escapeIlike(trimmed)}%`;
  return columns.map((col) => `${col}.ilike."${pattern}"`).join(',');
}

export const TRIP_SEARCH_COLUMNS = ['vehicle_number', 'route_name', 'driver_name'] as const;

export const EXPENSE_SEARCH_COLUMNS = [
  'description',
  'category',
  'vehicle_number',
  'person',
  'paid_by_person',
  'bill_receipt_ref',
  'paid_by',
  // expense_type is a PG enum — ilike fails and breaks the whole .or() filter
] as const;

export const VEHICLE_SEARCH_COLUMNS = [
  'vehicle_number',
  'vehicle_type',
  'model',
  'chassis_number',
] as const;

export const CAPITAL_SEARCH_COLUMNS = [
  'contributor',
  'description',
  'contribution_type',
  'asset_details',
  'paid_by',
] as const;
