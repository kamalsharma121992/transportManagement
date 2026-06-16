'use client';

import { useEffect, useState } from 'react';
import { clampPage, DEFAULT_PAGE_SIZE, getTotalPages } from '@/lib/pagination';

export function useServerPagination(resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [...resetDeps, pageSize]);

  const totalPages = getTotalPages(totalItems, pageSize);
  const currentPage = clampPage(page, totalItems, pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  return {
    page: currentPage,
    pageSize,
    setPage,
    setPageSize,
    totalItems,
    setTotalItems,
    totalPages,
  };
}
