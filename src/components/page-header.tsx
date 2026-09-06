'use client';

import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { TextSearchInput } from '@/components/text-search-input';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MobileActionsMenu } from '@/components/mobile-actions-menu';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  /**
   * Page-specific primary CTA (e.g. Add Trip). Always shown when set.
   * "Add Expense" is shown on every page separately.
   */
  primaryAction?: React.ReactNode | null;
  /** Secondary actions — inline on desktop, Actions dropdown on mobile */
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

const addExpenseButton = (
  <Link href="/expenses?add=1" className={cn(buttonVariants())}>
    <Plus className="h-4 w-4 mr-2" />
    Add Expense
  </Link>
);

export function PageHeader({
  title,
  primaryAction,
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
          {primaryAction}
          {addExpenseButton}
          {actions && (
            <>
              <MobileActionsMenu className="md:hidden">
                {actions}
              </MobileActionsMenu>
              <div className="hidden md:flex items-center gap-2">
                {actions}
              </div>
            </>
          )}
        </div>
      </div>

      {filterLabels.length > 0 && (
        <ActiveFiltersBar labels={filterLabels} />
      )}
    </div>
  );
}
