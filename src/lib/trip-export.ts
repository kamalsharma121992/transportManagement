import type { Trip } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/reports';
import { getTripPaymentDisplayStatus } from '@/lib/trip-payments';

/** Columns for CSV export */
export const TRIP_EXPORT_SELECT =
  'date,vehicle_number,route_name,driver_name,weight_tons,distance_km,rate_per_ton,commission,total_revenue,advance_paid,balance_due,payment_status,payment_expected_date,notes,builty_url';

/** Leaner columns for PDF table only */
export const TRIP_PDF_SELECT =
  'date,vehicle_number,route_name,driver_name,weight_tons,rate_per_ton,total_revenue,advance_paid,payment_status,payment_expected_date,notes,builty_url';

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
  builtyUrl: string;
};

const CSV_HEADERS = [
  'Date', 'Vehicle', 'Route', 'Driver', 'Weight (T)', 'Distance (km)', 'Rate/Ton',
  'Commission', 'Total Revenue', 'Advance Paid', 'Balance Due', 'Payment Status',
  'Payment', 'Expected Date', 'Notes', 'Builty URL',
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
    builtyUrl: trip.builty_url || '',
  }));
}

export function downloadTripsCsv(trips: Trip[], suffix: string): void {
  const rows = toTripExportRows(trips);
  downloadCsv(`trips-${suffix}.csv`, [
    [...CSV_HEADERS],
    ...rows.map((r) => [
      r.date, r.vehicle, r.route, r.driver, r.weight, r.distance, r.ratePerTon,
      r.commission, r.totalRevenue, r.advancePaid, r.balanceDue, r.paymentStatus,
      r.paymentDisplay, r.expectedDate, r.notes, r.builtyUrl,
    ]),
  ]);
}

function buildBuiltyCell(url: string): string {
  if (!url) return '';
  return `<a href="${escapeHtml(url)}" class="builty-link">View</a>`;
}

function buildTripsPdfHtml(params: {
  trips: Trip[];
  filterLabel: string;
  count: number;
  revenue: number;
  weight: number;
  pendingRevenue: number;
  paidRevenue: number;
  generatedOn: string;
}): string {
  const rows = params.trips;
  const parts: string[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const display = getTripPaymentDisplayStatus(t);
    const due = t.payment_expected_date ? escapeHtml(formatDate(t.payment_expected_date)) : '';
    parts[i] =
      `<tr><td>${escapeHtml(formatDate(t.date))}</td>` +
      `<td>${escapeHtml(t.vehicle_number)}</td>` +
      `<td>${escapeHtml(t.route_name)}</td>` +
      `<td>${escapeHtml(t.driver_name)}</td>` +
      `<td class="num">${Number(t.weight_tons).toFixed(2)}</td>` +
      `<td class="num">${escapeHtml(formatCurrency(Number(t.rate_per_ton)))}</td>` +
      `<td class="num">${escapeHtml(formatCurrency(Number(t.total_revenue)))}</td>` +
      `<td>${escapeHtml(display)}</td>` +
      `<td>${due}</td>` +
      `<td>${escapeHtml(t.notes || '')}</td>` +
      `<td>${buildBuiltyCell(t.builty_url || '')}</td></tr>`;
  }
  const tableRows = parts.length ? parts.join('') : '<tr><td colspan="11" class="muted">No trips</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Trips-${escapeHtml(params.filterLabel)}</title>
  <style>
    @page{size:A4 landscape;margin:10mm}
    body{margin:0;font:10px/1.35 Arial,sans-serif;color:#111}
    h1{font-size:16px;margin:0 0 4px}
    .meta{font-size:10px;color:#444;margin-bottom:10px}
    .summary{display:flex;flex-wrap:wrap;gap:16px 24px;margin-bottom:12px;font-size:11px}
    .summary strong{font-size:13px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #bbb;padding:3px 4px;text-align:left;vertical-align:top}
    th{background:#f3f3f3;font-size:9px;text-transform:uppercase}
    td.num,th.num{text-align:right;white-space:nowrap}
    .builty-link{color:#1d4ed8;text-decoration:none;white-space:nowrap}
    .muted{text-align:center;color:#666}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
  <h1>JM Transport — Trip Log</h1>
  <p class="meta">${escapeHtml(params.filterLabel)} · Generated ${escapeHtml(formatDate(params.generatedOn))} · ${params.count} trip(s)</p>
  <div class="summary">
    <div>Revenue <strong>${escapeHtml(formatCurrency(params.revenue))}</strong></div>
    <div>Weight <strong>${params.weight.toFixed(2)} T</strong></div>
    <div>Pending <strong>${escapeHtml(formatCurrency(params.pendingRevenue))}</strong></div>
    <div>Collected <strong>${escapeHtml(formatCurrency(params.paidRevenue))}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Vehicle</th><th>Route</th><th>Driver</th>
        <th class="num">Weight</th><th class="num">Rate/Ton</th><th class="num">Revenue</th>
        <th>Payment</th><th>Due</th><th>Notes</th><th>Builty</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}

/** Hidden-iframe print — avoids slow popup window.open. */
export function printTripsPdf(params: {
  trips: Trip[];
  filterLabel: string;
  count: number;
  revenue: number;
  weight: number;
  pendingRevenue: number;
  paidRevenue: number;
  generatedOn: string;
  fileSuffix?: string;
}): void {
  const html = buildTripsPdfHtml(params);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // ignore
    }
    setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 60_000);
  };

  iframe.onload = () => {
    requestAnimationFrame(() => setTimeout(doPrint, 50));
  };
  iframe.src = url;
  setTimeout(doPrint, 1500);
}
