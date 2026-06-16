'use client';

import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { TextSearchInput } from '@/components/text-search-input';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  actions?: React.ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  filterLabels?: string[];
};

export function PageHeader({
  title,
  actions,
  search,
  hasActiveFilters,
  onClearFilters,
  clearFiltersLabel = 'Reset',
  filterLabels = [],
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
            >
              <X className="h-3 w-3" />
              {clearFiltersLabel}
            </button>
          )}
        </div>

        {search && (
          <div className="flex-1 w-full sm:max-w-sm md:max-w-md lg:max-w-lg">
            <TextSearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
            />
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <Link href="/expenses?add=1" className={cn(buttonVariants())}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Link>
          {actions}
        </div>
      </div>

      {filterLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterLabels.map((label) => (
            <span
              key={label}
              className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
