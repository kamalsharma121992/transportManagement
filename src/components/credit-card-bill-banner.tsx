'use client';

import Link from 'next/link';
import { CreditCard, X } from 'lucide-react';
import { billNoticeText, capitalPayHref, type CardBillNotice } from '@/lib/credit-cards';

export function CreditCardBillBanner({
  notices,
  onDismiss,
}: {
  notices: CardBillNotice[];
  onDismiss: () => void;
}) {
  if (notices.length === 0) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
      <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {notices.length === 1
            ? '1 credit card bill generates within 2 days'
            : `${notices.length} credit card bills generate within 2 days`}
        </p>
        <ul className="mt-1 space-y-1 text-amber-900/90">
          {notices.map((notice) => (
            <li key={notice.card.id}>
              <Link href={capitalPayHref(notice)} className="font-medium underline underline-offset-2 hover:text-amber-950">
                {billNoticeText(notice)}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-amber-800/80">
          Click a bill to pay it from Capital.{' '}
          <Link href="/credit-cards" className="font-medium underline underline-offset-2 hover:text-amber-950">
            View all cards
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-amber-800 hover:bg-amber-200/80"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
