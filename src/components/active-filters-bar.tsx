'use client';

import { X } from 'lucide-react';

type ActiveFiltersBarProps = {
  labels: string[];
  onClear?: () => void;
  clearLabel?: string;
};

export function ActiveFiltersBar({
  labels,
  onClear,
  clearLabel = 'Clear all',
}: ActiveFiltersBarProps) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
      <span className="text-xs font-semibold text-gray-600 shrink-0">Showing:</span>
      {labels.map((label) => (
        <span
          key={label}
          className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 text-xs font-medium rounded-full"
        >
          {label}
        </span>
      ))}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
        >
          <X className="h-3 w-3" />
          {clearLabel}
        </button>
      )}
    </div>
  );
}
