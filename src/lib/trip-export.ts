import type { Trip } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/reports';
import { getTripPaymentDisplayStatus, isTripUnpaid } from '@/lib/trip-payments';
import { normalizeImageUrls } from '@/lib/image-urls';

/** Columns for CSV export */
export const TRIP_EXPORT_SELECT =
  'date,vehicle_number,route_name,driver_name,weight_tons,distance_km,rate_per_ton,commission,total_revenue,advance_paid,balance_due,payment_status,payment_expected_date,notes,builty_url,builty_urls';

/** Leaner columns for PDF table only */
export const TRIP_PDF_SELECT =
  'date,vehicle_number,route_name,driver_name,weight_tons,rate_per_ton,total_revenue,advance_paid,balance_due,payment_status,payment_expected_date,notes,builty_url,builty_urls';

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

export function tripExportTotals(trips: Trip[]) {
  return {
    count: trips.length,
    revenue: trips.reduce((s, t) => s + Number(t.total_revenue), 0),
    weight: trips.reduce((s, t) => s + Number(t.weight_tons), 0),
    pendingRevenue: trips.reduce((s, t) => (
      isTripUnpaid(t.payment_status) ? s + Number(t.balance_due || 0) : s
    ), 0),
    paidRevenue: trips.reduce((s, t) => (
      t.payment_status === 'Fully Paid'
        ? s + Number(t.total_revenue)
        : s + Number(t.advance_paid || 0)
    ), 0),
  };
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
    builtyUrl: normalizeImageUrls(trip.builty_urls, trip.builty_url).join(' '),
  }));
}

export function downloadTripsCsv(trips: Trip[], suffix: string): void {
  const rows = toTripExportRows(trips);
  const totals = tripExportTotals(trips);
  downloadCsv(`trips-${suffix}.csv`, [
    [...CSV_HEADERS],
    ...rows.map((r) => [
      r.date, r.vehicle, r.route, r.driver, r.weight, r.distance, r.ratePerTon,
      r.commission, r.totalRevenue, r.advancePaid, r.balanceDue, r.paymentStatus,
      r.paymentDisplay, r.expectedDate, r.notes, r.builtyUrl,
    ]),
    [],
    ['', '', '', 'TOTAL', totals.weight.toFixed(2), '', '', '', String(totals.revenue), '', '', '', '', '', '', ''],
    ['', '', '', 'Pending', '', '', '', '', String(totals.pendingRevenue), '', '', '', '', '', '', ''],
    ['', '', '', 'Collected', '', '', '', '', String(totals.paidRevenue), '', '', '', '', '', '', ''],
  ]);
}

function buildBuiltyCell(trip: Trip): string {
  const urls = normalizeImageUrls(trip.builty_urls, trip.builty_url);
  if (urls.length === 0) return '';
  if (urls.length === 1) {
    return `<a href="${escapeHtml(urls[0])}" class="builty-link">View</a>`;
  }
  return `<a href="${escapeHtml(urls[0])}" class="builty-link">View (${urls.length})</a>`;
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
    const expected = t.payment_expected_date ? escapeHtml(formatDate(t.payment_expected_date)) : '';
    const balanceDue = Number(t.balance_due || 0);
    parts[i] =
      `<tr><td>${escapeHtml(formatDate(t.date))}</td>` +
      `<td>${escapeHtml(t.vehicle_number)}</td>` +
      `<td>${escapeHtml(t.route_name)}</td>` +
      `<td>${escapeHtml(t.driver_name)}</td>` +
      `<td class="num">${Number(t.weight_tons).toFixed(2)}</td>` +
      `<td class="num">${escapeHtml(formatCurrency(Number(t.rate_per_ton)))}</td>` +
      `<td class="num">${escapeHtml(formatCurrency(Number(t.total_revenue)))}</td>` +
      `<td class="num">${escapeHtml(formatCurrency(balanceDue))}</td>` +
      `<td>${escapeHtml(display)}</td>` +
      `<td>${expected}</td>` +
      `<td>${escapeHtml(t.notes || '')}</td>` +
      `<td>${buildBuiltyCell(t)}</td></tr>`;
  }
  const tableRows = parts.length ? parts.join('') : '<tr><td colspan="12" class="muted">No trips</td></tr>';

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
    .summary{display:flex;flex-wrap:wrap;gap:16px 28px;margin-bottom:14px;font-size:11px}
    .summary .total{font-size:12px}
    .summary strong{font-size:14px}
    .summary .total strong{font-size:16px;color:#15803d}
    .summary .due strong{color:#b45309}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #bbb;padding:3px 4px;text-align:left;vertical-align:top}
    th{background:#f3f3f3;font-size:9px;text-transform:uppercase}
    td.num,th.num{text-align:right;white-space:nowrap}
    tfoot td{font-weight:bold;background:#f8f8f8}
    tfoot .total-label{text-align:right}
    .builty-link{color:#1d4ed8;text-decoration:none;white-space:nowrap}
    .muted{text-align:center;color:#666}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
  <h1>JM Transport — Trip Log</h1>
  <p class="meta">${escapeHtml(params.filterLabel)} · Generated ${escapeHtml(formatDate(params.generatedOn))} · ${params.count} trip(s)</p>
  <div class="summary">
    <div class="total">Revenue <strong>${escapeHtml(formatCurrency(params.revenue))}</strong></div>
    <div>Weight <strong>${params.weight.toFixed(2)} T</strong></div>
    <div class="due">Due <strong>${escapeHtml(formatCurrency(params.pendingRevenue))}</strong></div>
    <div>Collected <strong>${escapeHtml(formatCurrency(params.paidRevenue))}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Vehicle</th><th>Route</th><th>Driver</th>
        <th class="num">Weight</th><th class="num">Rate/Ton</th><th class="num">Revenue</th>
        <th class="num">Due</th><th>Payment</th><th>Expected</th><th>Notes</th><th>Builty</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="total-label">Total</td>
        <td class="num">${params.weight.toFixed(2)}</td>
        <td></td>
        <td class="num">${escapeHtml(formatCurrency(params.revenue))}</td>
        <td class="num">${escapeHtml(formatCurrency(params.pendingRevenue))}</td>
        <td colspan="4"></td>
      </tr>
    </tfoot>
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
