'use client';

import { useState } from 'react';
import { nextSort, type SortDirection } from '@/lib/sort';

export function useTableSort(defaultColumn: string, defaultDirection: SortDirection = 'desc') {
  const [sortColumn, setSortColumn] = useState(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  function toggleSort(column: string, defaultWhenNew: SortDirection = 'desc') {
    const next = nextSort(sortColumn, sortDirection, column, defaultWhenNew);
    setSortColumn(next.column);
    setSortDirection(next.direction);
  }

  return { sortColumn, sortDirection, toggleSort };
}
