'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  billLeft,
  capitalPayHref,
  fetchCardBillRows,
  ordinalDay,
  type CardBillRow,
} from '@/lib/credit-cards';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function whenLabel(days: number | null): string {
  if (days == null) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function payNotice(row: CardBillRow) {
  if (billLeft(row) <= 0) return null;
  return {
    card: row.card,
    daysUntil: row.daysUntil ?? 0,
    amount: row.amount,
    paid: row.paid,
  };
}

export default function CreditCardsPage() {
  const [rows, setRows] = useState<CardBillRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCardBillRows()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const dueSoon = rows.filter((row) => row.dueSoon);
  const generatedSoon = dueSoon.reduce((sum, row) => sum + row.amount, 0);
  const leftSoon = dueSoon.reduce((sum, row) => sum + billLeft(row), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Credit Cards" />

      <div className="grid grid-cols-3 gap-3">
        <Card className={dueSoon.length ? 'border-amber-300' : ''}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Due within 2 days</p>
            <p className="text-2xl font-bold text-amber-700">{dueSoon.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Generated</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(generatedSoon)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Left to pay</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(leftSoon)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="py-8 text-center text-gray-500">Loading...</CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-gray-500">No credit cards. Add them in Admin.</CardContent></Card>
        ) : rows.map((row) => {
          const notice = payNotice(row);
          return (
            <Card key={row.card.id} className={cn(row.dueSoon && 'border-amber-400 bg-amber-50')}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{row.card.label}</p>
                    <p className="text-sm text-gray-600">{row.card.holder}</p>
                  </div>
                  <p className="font-bold text-gray-900">{formatCurrency(billLeft(row))}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Generated</p>
                    <p>{formatCurrency(row.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Paid</p>
                    <p>{formatCurrency(row.paid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Left</p>
                    <p>{formatCurrency(billLeft(row))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Bill generate</p>
                    <p>{row.card.bill_generate_day ? ordinalDay(row.card.bill_generate_day) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Bill pay</p>
                    <p>{row.card.bill_pay_day ? `${ordinalDay(row.card.bill_pay_day)} · ${whenLabel(row.daysUntil)}` : '—'}</p>
                  </div>
                </div>
                {notice ? (
                  <Link
                    href={capitalPayHref(notice)}
                    className={cn(buttonVariants({ size: 'sm' }), 'bg-green-600 text-white hover:bg-green-700')}
                  >
                    <Banknote className="h-3.5 w-3.5 mr-1" /> Pay {formatCurrency(billLeft(row))}
                  </Link>
                ) : row.amount > 0 ? (
                  <p className="text-sm font-medium text-green-700">Paid</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead>Bill generate</TableHead>
                  <TableHead>Bill pay</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Generated</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">No credit cards. Add them in Admin.</TableCell></TableRow>
                ) : rows.map((row) => {
                  const notice = payNotice(row);
                  return (
                    <TableRow key={row.card.id} className={row.dueSoon ? 'bg-amber-50' : undefined}>
                      <TableCell className="font-medium">{row.card.label}</TableCell>
                      <TableCell>{row.card.holder}</TableCell>
                      <TableCell>
                        {row.card.bill_generate_day ? ordinalDay(row.card.bill_generate_day) : '—'}
                      </TableCell>
                      <TableCell>
                        {row.card.bill_pay_day ? (
                          <span>
                            {ordinalDay(row.card.bill_pay_day)}
                            <span className={cn('ml-2 text-xs', row.dueSoon ? 'text-amber-800 font-medium' : 'text-gray-500')}>
                              {whenLabel(row.daysUntil)}
                            </span>
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {row.cycleFrom && row.cycleTo ? `${formatDate(row.cycleFrom)} – ${formatDate(row.cycleTo)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(billLeft(row))}</TableCell>
                      <TableCell>
                        {notice ? (
                          <Link
                            href={capitalPayHref(notice)}
                            className={cn(buttonVariants({ size: 'sm' }), 'bg-green-600 text-white hover:bg-green-700')}
                          >
                            Pay
                          </Link>
                        ) : row.amount > 0 ? (
                          <span className="text-sm font-medium text-green-700">Paid</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
