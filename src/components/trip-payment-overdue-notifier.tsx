'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { fetchOverdueTripCount } from '@/lib/trip-payments';

/** Loads overdue pending-trip count for the Trip Log sidebar badge. */
export function TripPaymentOverdueNotifier({
  onOverdue,
}: {
  onOverdue?: (count: number) => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    fetchOverdueTripCount()
      .then((count) => {
        if (!cancelled) onOverdue?.(count);
      })
      .catch(() => {
        if (!cancelled) onOverdue?.(0);
      });

    return () => {
      cancelled = true;
    };
  }, [onOverdue, pathname]);

  return null;
}
