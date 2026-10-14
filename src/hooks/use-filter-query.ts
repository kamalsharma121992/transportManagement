'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function splitQueryList(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

/** Missing `month` means the current month. `month=` means all months. */
export function readMonthParam(
  params: { get: (key: string) => string | null; has: (key: string) => boolean },
  currentMonth: string,
): string {
  return params.has('month') ? (params.get('month') || '') : currentMonth;
}

export function readSortParam(
  params: { get: (key: string) => string | null },
  fallbackColumn: string,
  fallbackDir: 'asc' | 'desc' = 'desc',
): { column: string; dir: 'asc' | 'desc' } {
  const dir = params.get('dir');
  return {
    column: params.get('sort') || fallbackColumn,
    dir: dir === 'asc' || dir === 'desc' ? dir : fallbackDir,
  };
}

export type FilterField = {
  key: string;
  value: string | string[];
  /** Left out of the URL when the current value matches. */
  defaultValue?: string | string[];
};

function serialize(value: string | string[] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(',') : value;
}

/** Lets several sections on the same page update the query in one turn. */
let queued: { pathname: string; query: string } | null = null;

function liveQuery(pathname: string): URLSearchParams {
  const actual = window.location.search.replace(/^\?/, '');
  if (queued && queued.pathname === pathname && window.location.pathname === pathname) {
    return new URLSearchParams(queued.query);
  }
  return new URLSearchParams(actual);
}

/**
 * Writes filter fields into the query string and leaves every other key alone.
 * `omitKeys` are one-shot action params (add, pay) that should not stick around.
 */
export function useFilterQuery(fields: FilterField[], omitKeys: string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const omitRef = useRef(omitKeys);
  omitRef.current = omitKeys;

  const signature = fields
    .map((field) => `${field.key}=${serialize(field.value)}/${serialize(field.defaultValue)}`)
    .join('|');
  const omitSignature = omitKeys.join(',');

  useEffect(() => {
    const actual = window.location.search.replace(/^\?/, '');
    const merged = liveQuery(pathname);
    for (const key of omitRef.current) merged.delete(key);
    for (const field of fieldsRef.current) {
      const value = serialize(field.value);
      const fallback = serialize(field.defaultValue ?? (Array.isArray(field.value) ? [] : ''));
      if (value === fallback) merged.delete(field.key);
      else merged.set(field.key, value);
    }
    const next = merged.toString();
    if (next === actual) {
      if (queued?.pathname === pathname) queued = null;
      return;
    }
    queued = { pathname, query: next };
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [signature, omitSignature, pathname, router, searchParams]);
}
