'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AuthGate } from '@/components/auth-gate';
import { ExpenseAdvanceOverdueNotifier } from '@/components/expense-advance-overdue-notifier';
import { ExpenseAdvanceOverdueBanner } from '@/components/expense-advance-overdue-banner';

const PUBLIC_ROUTES = ['/submit'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const [overdueCount, setOverdueCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const onOverdue = useCallback((count: number) => {
    setOverdueCount(count);
  }, []);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <ExpenseAdvanceOverdueNotifier onOverdue={onOverdue} />
      <Sidebar overdueCount={overdueCount} />
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
