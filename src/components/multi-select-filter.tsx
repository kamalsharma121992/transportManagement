'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { FILTER_SELECT_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          FILTER_SELECT_CLASS,
          'flex items-center justify-between gap-2 text-left',
          selected.length > 0 && 'border-blue-300 bg-blue-50/40',
        )}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-gray-500')}>
          {triggerLabel}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              className="rounded p-0.5 text-gray-400 hover:text-gray-700 hover:bg-white"
              aria-label={`Clear ${label}`}
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[12rem] rounded-md border bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-gray-500">No options</p>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
