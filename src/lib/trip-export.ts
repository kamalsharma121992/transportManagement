import type { Trip } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/reports';
import { getTripPaymentDisplayStatus } from '@/lib/trip-payments';

export type TripExportRow = {
  date: string;
  vehicle: string;
  route: string;
  driver: string;
  weight: string;
  distance: string;
  ratePerTon: string;
  commission: string;
  totalRevenue: string;
  advancePaid: string;
  balanceDue: string;
  paymentStatus: string;
  paymentDisplay: string;
  expectedDate: string;
  notes: string;
};

const CSV_HEADERS = [
  'Date', 'Vehicle', 'Route', 'Driver', 'Weight (T)', 'Distance (km)', 'Rate/Ton',
  'Commission', 'Total Revenue', 'Advance Paid', 'Balance Due', 'Payment Status',
  'Payment', 'Expected Date', 'Notes',
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tripExportSuffix(
  filterMonth: string,
  filterDateFrom: string,
  filterDateTo: string,
): string {
  if (filterMonth) return filterMonth;
  if (filterDateFrom && filterDateTo) return `${filterDateFrom}-to-${filterDateTo}`;
  return 'filtered';
}

export function toTripExportRows(trips: Trip[]): TripExportRow[] {
  return trips.map((trip) => ({
    date: trip.date,
    vehicle: trip.vehicle_number,
    route: trip.route_name,
    driver: trip.driver_name,
    weight: Number(trip.weight_tons).toFixed(2),
    distance: String(trip.distance_km ?? ''),
    ratePerTon: String(trip.rate_per_ton),
    commission: String(trip.commission ?? 0),
    totalRevenue: String(trip.total_revenue),
    advancePaid: String(trip.advance_paid ?? 0),
    balanceDue: String(trip.balance_due ?? 0),
    paymentStatus: trip.payment_status,
    paymentDisplay: getTripPaymentDisplayStatus(trip),
    expectedDate: trip.payment_expected_date || '',
    notes: trip.notes || '',
  }));
}

export function downloadTripsCsv(trips: Trip[], suffix: string): void {
  const rows = toTripExportRows(trips);
  downloadCsv(`trips-${suffix}.csv`, [
    [...CSV_HEADERS],
    ...rows.map((r) => [
      r.date, r.vehicle, r.route, r.driver, r.weight, r.distance, r.ratePerTon,
      r.commission, r.totalRevenue, r.advancePaid, r.balanceDue, r.paymentStatus,
      r.paymentDisplay, r.expectedDate, r.notes,
    ]),
  ]);
}

export function printTripsPdf(params: {
  trips: Trip[];
  filterLabel: string;
  count: number;
  revenue: number;
  weight: number;
  pendingRevenue: number;
  paidRevenue: number;
  generatedOn: string;
}): void {
  const popup = window.open('', '_blank', 'width=1200,height=900');
  if (!popup) {
    throw new Error('Allow pop-ups to download the PDF');
  }

  const rows = toTripExportRows(params.trips);
  const tableRows = rows.length
    ? rows.map((r) => `
        <tr>
          <td>${escapeHtml(formatDate(r.date))}</td>
          <td>${escapeHtml(r.vehicle)}</td>
          <td>${escapeHtml(r.route)}</td>
          <td>${escapeHtml(r.driver)}</td>
          <td class="num">${escapeHtml(r.weight)}</td>
          <td class="num">${escapeHtml(formatCurrency(Number(r.ratePerTon)))}</td>
          <td class="num">${escapeHtml(formatCurrency(Number(r.totalRevenue)))}</td>
          <td>${escapeHtml(r.paymentDisplay)}</td>
          <td>${r.expectedDate ? escapeHtml(formatDate(r.expectedDate)) : ''}</td>
          <td>${escapeHtml(r.notes)}</td>
        </tr>`).join('')
    : '<tr><td colspan="10" class="muted">No trips</td></tr>';

  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Trips-${escapeHtml(params.filterLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; font: 10px/1.35 Arial, sans-serif; color: #111; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { font-size: 10px; color: #444; margin-bottom: 10px; }
    .summary { display: flex; flex-wrap: wrap; gap: 16px 24px; margin-bottom: 12px; font-size: 11px; }
    .summary strong { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #bbb; padding: 4px 5px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; font-size: 9px; text-transform: uppercase; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .muted { text-align: center; color: #666; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>JM Transport — Trip Log</h1>
  <p class="meta">${escapeHtml(params.filterLabel)} · Generated ${escapeHtml(formatDate(params.generatedOn))} · ${params.count} trip(s)</p>
  <div class="summary">
    <div>Revenue <strong>${escapeHtml(formatCurrency(params.revenue))}</strong></div>
    <div>Weight <strong>${escapeHtml(params.weight.toFixed(2))} T</strong></div>
    <div>Pending <strong>${escapeHtml(formatCurrency(params.pendingRevenue))}</strong></div>
    <div>Collected <strong>${escapeHtml(formatCurrency(params.paidRevenue))}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Vehicle</th><th>Route</th><th>Driver</th>
        <th class="num">Weight</th><th class="num">Rate/Ton</th><th class="num">Revenue</th>
        <th>Payment</th><th>Due</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close());
  setTimeout(() => popup.print(), 250);
}
