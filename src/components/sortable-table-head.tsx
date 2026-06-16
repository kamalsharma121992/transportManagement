'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection } from '@/lib/sort';

type SortableTableHeadProps = {
  label: string;
  column: string;
  activeColumn: string;
  direction: SortDirection;
  onSort: (column: string) => void;
  className?: string;
};

export function SortableTableHead({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  className,
}: SortableTableHeadProps) {
  const active = activeColumn === column;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 -ml-1 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors',
          active ? 'text-gray-900 font-semibold' : 'text-gray-600 font-medium',
          className?.includes('text-right') && 'ml-auto',
        )}
      >
        {label}
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
