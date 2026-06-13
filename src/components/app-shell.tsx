'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AuthGate } from '@/components/auth-gate';

const PUBLIC_ROUTES = ['/submit'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <Sidebar />
      <main className="md:ml-64 min-h-full p-4 md:p-8 pt-16 md:pt-8">
        {children}
      </main>
    </AuthGate>
  );
}
