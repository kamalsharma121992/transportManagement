export type SortDirection = 'asc' | 'desc';

export function nextSort(
  currentColumn: string,
  currentDirection: SortDirection,
  clickedColumn: string,
  defaultDirection: SortDirection = 'desc',
): { column: string; direction: SortDirection } {
  if (currentColumn === clickedColumn) {
    return {
      column: clickedColumn,
      direction: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return { column: clickedColumn, direction: defaultDirection };
}

export function applySupabaseSort<Q>(query: Q, column: string, direction: SortDirection): Q {
  const q = query as {
    order: (col: string, opts: { ascending: boolean }) => Q;
  };
  return q.order(column, { ascending: direction === 'asc' });
}
