import { supabase, type TripPaymentStatus } from '@/lib/supabase';
import { TRIP_PAYMENT_WARNING_DAYS } from '@/lib/constants';

export const TRIP_PAYMENT_DISPLAY_FILTERS = ['Fully Paid', 'Pending', 'Partial Pending'] as const;
export type TripPaymentDisplayStatus = (typeof TRIP_PAYMENT_DISPLAY_FILTERS)[number];

export function todayDateString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isTripUnpaid(status: string): boolean {
  return status !== 'Fully Paid';
}

export function isTripPaymentOverdue(trip: {
  payment_status: string;
  payment_expected_date?: string | null;
}, today = todayDateString()): boolean {
  if (!isTripUnpaid(trip.payment_status)) return false;
  if (!trip.payment_expected_date) return false;
  return trip.payment_expected_date <= today;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayDateString(d);
}

/** Pending trip with an expected date within the warning window, but not yet overdue. */
export function isTripPaymentDueSoon(trip: {
  payment_status: string;
  payment_expected_date?: string | null;
}, today = todayDateString()): boolean {
  if (!isTripUnpaid(trip.payment_status)) return false;
  if (!trip.payment_expected_date) return false;
  if (isTripPaymentOverdue(trip, today)) return false;
  return trip.payment_expected_date <= addDaysToDateString(today, TRIP_PAYMENT_WARNING_DAYS);
}

export function getTripPaymentDisplayStatus(trip: {
  payment_status: string;
  advance_paid?: number | null;
}): TripPaymentDisplayStatus {
  if (trip.payment_status === 'Fully Paid') return 'Fully Paid';
  if (Number(trip.advance_paid || 0) > 0) return 'Partial Pending';
  return 'Pending';
}

export function isFullPendingAmounts(trip: {
  payment_status: string;
  advance_paid?: number | null;
  balance_due?: number | null;
  total_revenue?: number | null;
}): boolean {
  if (!isTripUnpaid(trip.payment_status)) return false;
  return Number(trip.advance_paid || 0) === 0
    && Number(trip.balance_due || 0) === Number(trip.total_revenue || 0);
}

export async function fetchOverdueTripCount(): Promise<number> {
  const today = todayDateString();
  const { count, error } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .neq('payment_status', 'Fully Paid')
    .not('payment_expected_date', 'is', null)
    .lte('payment_expected_date', today);

  if (error) throw error;
  return count || 0;
}

export function normalizeTripPaymentStatus(status: string | null | undefined): TripPaymentStatus {
  if (status === 'Fully Paid') return 'Fully Paid';
  return 'Pending';
}

/** Apply multi-select payment display filters to a Supabase query. */
export function applyTripPaymentDisplayFilter<Q>(query: Q, selected: readonly string[]): Q {
  const filters = selected.filter((s): s is TripPaymentDisplayStatus =>
    (TRIP_PAYMENT_DISPLAY_FILTERS as readonly string[]).includes(s));
  if (filters.length === 0 || filters.length === TRIP_PAYMENT_DISPLAY_FILTERS.length) {
    return query;
  }

  type FilterQuery = {
    eq: (col: string, val: string | number) => FilterQuery;
    gt: (col: string, val: number) => FilterQuery;
    or: (filter: string) => FilterQuery;
  };
  const q = query as FilterQuery;

  const hasFullyPaid = filters.includes('Fully Paid');
  const hasPending = filters.includes('Pending');
  const hasPartial = filters.includes('Partial Pending');

  if (filters.length === 1) {
    if (hasFullyPaid) return q.eq('payment_status', 'Fully Paid') as Q;
    if (hasPending) return q.eq('payment_status', 'Pending').eq('advance_paid', 0) as Q;
    if (hasPartial) return q.eq('payment_status', 'Pending').gt('advance_paid', 0) as Q;
  }

  if (hasPending && hasPartial && !hasFullyPaid) {
    return q.eq('payment_status', 'Pending') as Q;
  }

  const clauses: string[] = [];
  if (hasFullyPaid) clauses.push('payment_status.eq."Fully Paid"');
  if (hasPending && hasPartial) {
    clauses.push('payment_status.eq."Pending"');
  } else if (hasPending) {
    clauses.push('and(payment_status.eq."Pending",advance_paid.eq.0)');
  } else if (hasPartial) {
    clauses.push('and(payment_status.eq."Pending",advance_paid.gt.0)');
  }

  return clauses.length > 0 ? (q.or(clauses.join(',')) as Q) : query;
}
