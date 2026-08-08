'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — redirects to Expense Advances */
export default function TripAdvancesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/expense-advances');
  }, [router]);
  return null;
}
