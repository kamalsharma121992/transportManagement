'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { fetchOpenExpenseAdvanceAlertCounts } from '@/lib/expense-advances';
import { EXPENSE_ADVANCE_OVERDUE_DAYS } from '@/lib/constants';

const TOAST_SESSION_KEY = 'expense-advance-overdue-toast';

/**
 * Checks for overdue expense advances and shows a toast once per browser session
 * (re-fires if the overdue count changes). Also exposes the overdue count via onOverdue.
 */
export function ExpenseAdvanceOverdueNotifier({
  onOverdue,
}: {
  onOverdue?: (count: number) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetchOpenExpenseAdvanceAlertCounts()
      .then(({ overdue }) => {
        if (cancelled) return;
        onOverdue?.(overdue);

        if (overdue <= 0) return;

        const fingerprint = String(overdue);
        try {
          if (sessionStorage.getItem(TOAST_SESSION_KEY) === fingerprint) return;
          sessionStorage.setItem(TOAST_SESSION_KEY, fingerprint);
        } catch {
          // sessionStorage unavailable — still toast
        }

        toast.error(
          overdue === 1
            ? '1 expense advance is overdue'
            : `${overdue} expense advances are overdue`,
          {
            description: `Open for ${EXPENSE_ADVANCE_OVERDUE_DAYS}+ days — settle or follow up.`,
            duration: 12000,
            action: {
              label: 'View',
              onClick: () => router.push('/expense-advances'),
            },
          },
        );
      })
      .catch(() => {
        if (!cancelled) onOverdue?.(0);
      });

    return () => {
      cancelled = true;
    };
  }, [onOverdue, router]);

  return null;
}
