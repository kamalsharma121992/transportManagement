'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { FILTER_SELECT_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
};

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
};

const DROPDOWN_MIN_WIDTH = 224;
const DROPDOWN_GAP = 4;
const DROPDOWN_PADDING = 8;

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
  searchable = false,
  searchPlaceholder = 'Search...',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, DROPDOWN_MIN_WIDTH);
    let left = rect.left;
    if (left + width > window.innerWidth - DROPDOWN_PADDING) {
      left = Math.max(DROPDOWN_PADDING, window.innerWidth - width - DROPDOWN_PADDING);
    }

    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP - DROPDOWN_PADDING;
    const spaceAbove = rect.top - DROPDOWN_GAP - DROPDOWN_PADDING;
    const placement = spaceBelow >= 160 || spaceBelow >= spaceAbove ? 'bottom' : 'top';
    const maxHeight = Math.max(160, Math.min(320, placement === 'bottom' ? spaceBelow : spaceAbove));

    setPosition({
      top: placement === 'bottom' ? rect.bottom + DROPDOWN_GAP : rect.top - DROPDOWN_GAP,
      left,
      width,
      maxHeight,
      placement,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch('');
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && searchable) {
      searchRef.current?.focus();
    }
    if (!open) setSearch('');
  }, [open, searchable]);

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, search]);

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  function handleOpen() {
    setOpen((prev) => !prev);
  }

  const dropdown = open && mounted && position
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 rounded-md border bg-white shadow-lg"
          style={{
            top: position.placement === 'bottom' ? position.top : undefined,
            bottom: position.placement === 'top' ? window.innerHeight - position.top : undefined,
            left: position.left,
            width: position.width,
          }}
        >
          {searchable && (
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpen(false);
                      setSearch('');
                    }
                  }}
                />
              </div>
            </div>
          )}
          <div
            className="overflow-y-auto p-2 space-y-0.5"
            style={{ maxHeight: position.maxHeight - (searchable ? 56 : 0) }}
          >
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-gray-500">
                {search.trim() ? 'No matches' : 'No options'}
              </p>
            ) : (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 shrink-0"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                  />
                  <span className="break-words">{option}</span>
                </label>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
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
      {dropdown}
    </div>
  );
}
