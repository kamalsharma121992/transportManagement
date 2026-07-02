export type FilterOption = { value: string; label: string };

export function toFilterOptions(values: string[]): FilterOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

export function formatMultiFilterLabel(
  prefix: string,
  selected: string[],
  labelMap?: Record<string, string>,
): string | null {
  if (selected.length === 0) return null;
  const labels = selected.map((v) => labelMap?.[v] ?? v);
  if (labels.length === 1) return `${prefix}: ${labels[0]}`;
  return `${prefix}: ${labels.join(', ')}`;
}

type InFilterQuery<Q> = Q & {
  eq: (col: string, val: string | number) => Q;
  in: (col: string, vals: (string | number)[]) => Q;
};

export function applyInFilter<Q>(
  query: Q,
  column: string,
  values: string[],
): Q {
  if (values.length === 0) return query;
  const q = query as InFilterQuery<Q>;
  if (values.length === 1) return q.eq(column, values[0]);
  return q.in(column, values);
}

export function applyInNumberFilter<Q>(
  query: Q,
  column: string,
  values: string[],
): Q {
  if (values.length === 0) return query;
  const ids = values.map(Number);
  const q = query as InFilterQuery<Q>;
  if (ids.length === 1) return q.eq(column, ids[0]);
  return q.in(column, ids);
}

export function hasMultiValueFilters(...arrays: string[][]): boolean {
  return arrays.some((arr) => arr.length > 1);
}
