'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cardBillNotices, enrichBillNotices, fetchCreditCards, type CardBillNotice } from '@/lib/credit-cards';

/** Loads credit cards whose payment is due within 2 days. */
export function CreditCardBillNotifier({
  onNotices,
}: {
  onNotices?: (notices: CardBillNotice[]) => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    fetchCreditCards(true)
      .then(({ data }) => enrichBillNotices(cardBillNotices(data)))
      .then((notices) => {
        if (!cancelled) onNotices?.(notices);
      })
      .catch(() => {
        if (!cancelled) onNotices?.([]);
      });

    return () => {
      cancelled = true;
    };
  }, [onNotices, pathname]);

  return null;
}
