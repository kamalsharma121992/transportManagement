'use client';

import { useEffect } from 'react';
import { fetchOpenExpenseAdvanceAlertCounts } from '@/lib/expense-advances';

export type ExpenseAdvanceAlertCounts = {
  overdue: number;
  warning: number;
};

/** Loads open expense-advance warning/overdue counts for sidebar + banner. */
export function ExpenseAdvanceOverdueNotifier({
  onAlerts,
}: {
  onAlerts?: (counts: ExpenseAdvanceAlertCounts) => void;
}) {
  useEffect(() => {
    let cancelled = false;

    fetchOpenExpenseAdvanceAlertCounts()
      .then(({ overdue, warning }) => {
        if (!cancelled) onAlerts?.({ overdue, warning });
      })
      .catch(() => {
        if (!cancelled) onAlerts?.({ overdue: 0, warning: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [onAlerts]);

  return null;
}
