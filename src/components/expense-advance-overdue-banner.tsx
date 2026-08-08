'use client';

import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { EXPENSE_ADVANCE_OVERDUE_DAYS } from '@/lib/constants';

/** Banner only for overdue advances (not warnings). */
export function ExpenseAdvanceOverdueBanner({
  overdueCount,
  onDismiss,
}: {
  overdueCount: number;
  onDismiss: () => void;
}) {
  if (overdueCount <= 0) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-900 shadow-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {overdueCount === 1
            ? '1 expense advance is overdue'
            : `${overdueCount} expense advances are overdue`}
        </p>
        <p className="mt-0.5 text-red-800/90">
          Open for {EXPENSE_ADVANCE_OVERDUE_DAYS}+ days without full settlement.{' '}
          <Link href="/expense-advances" className="font-medium underline underline-offset-2 hover:text-red-950">
            Review Expense Advances
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-red-700 hover:bg-red-200/80 hover:text-red-950"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
