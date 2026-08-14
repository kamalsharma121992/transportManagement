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
