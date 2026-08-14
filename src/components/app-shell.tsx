'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AuthGate } from '@/components/auth-gate';
import { ExpenseAdvanceOverdueNotifier } from '@/components/expense-advance-overdue-notifier';
import { ExpenseAdvanceOverdueBanner } from '@/components/expense-advance-overdue-banner';
import { TripPaymentOverdueNotifier } from '@/components/trip-payment-overdue-notifier';

const PUBLIC_ROUTES = ['/submit'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const [overdueCount, setOverdueCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [tripOverdueCount, setTripOverdueCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const onAlerts = useCallback((counts: { overdue: number; warning: number }) => {
    setOverdueCount(counts.overdue);
    setWarningCount(counts.warning);
  }, []);
  const onTripOverdue = useCallback((count: number) => {
    setTripOverdueCount(count);
  }, []);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <ExpenseAdvanceOverdueNotifier onAlerts={onAlerts} />
      <TripPaymentOverdueNotifier onOverdue={onTripOverdue} />
      <Sidebar
        overdueCount={overdueCount}
        warningCount={warningCount}
        tripOverdueCount={tripOverdueCount}
      />
      <main className="md:ml-64 min-h-full p-4 md:p-8 pt-16 md:pt-8">
        {!bannerDismissed && (
          <ExpenseAdvanceOverdueBanner
            overdueCount={overdueCount}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {children}
      </main>
    </AuthGate>
  );
}
