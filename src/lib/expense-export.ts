import type { Expense } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/reports';

export type ExpenseExportRow = {
  date: string;
  type: string;
  vehicle: string;
  category: string;
  amount: string;
  description: string;
  entity: string;
  paidBy: string;
  givenTo: string;
  paidFrom: string;
  status: string;
  billReceipt: string;
};

const CSV_HEADERS = [
  'Date', 'Type', 'Vehicle', 'Category', 'Amount', 'Description',
  'Entity', 'Paid By', 'Given To', 'Paid From', 'Status', 'Bill / Receipt',
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function expenseExportSuffix(
  filterMonth: string,
  filterDateFrom: string,
  filterDateTo: string,
): string {
  if (filterMonth) return filterMonth;
  if (filterDateFrom && filterDateTo) return `${filterDateFrom}-to-${filterDateTo}`;
  return 'filtered';
}

export function expenseExportTotals(expenses: Expense[]) {
  return {
    total: expenses.reduce((s, e) => s + Number(e.amount), 0),
    jmTotal: expenses.filter((e) => e.paid_by === 'JM transport').reduce((s, e) => s + Number(e.amount), 0),
    maheshTotal: expenses.filter((e) => e.paid_by === 'Mahesh').reduce((s, e) => s + Number(e.amount), 0),
  };
}

export function toExpenseExportRows(expenses: Expense[]): ExpenseExportRow[] {
  return expenses.map((exp) => ({
    date: exp.date,
    type: exp.expense_type,
    vehicle: exp.vehicle_number || '',
    category: exp.category,
    amount: String(exp.amount),
    description: exp.description || '',
    entity: exp.paid_by === 'JM transport' ? 'JM' : exp.paid_by,
    paidBy: exp.paid_by_person || '',
    givenTo: exp.person || '',
    paidFrom: exp.payment_source || '',
    status: exp.status || '',
    billReceipt: exp.bill_receipt_ref || '',
  }));
}

export function downloadExpensesCsv(expenses: Expense[], suffix: string): void {
  const rows = toExpenseExportRows(expenses);
  const { total, jmTotal, maheshTotal } = expenseExportTotals(expenses);
  downloadCsv(`expenses-${suffix}.csv`, [
    [...CSV_HEADERS],
    ...rows.map((r) => [
      r.date, r.type, r.vehicle, r.category, r.amount, r.description,
      r.entity, r.paidBy, r.givenTo, r.paidFrom, r.status, r.billReceipt,
    ]),
    [],
    ['', '', '', 'TOTAL', String(total), '', '', '', '', '', '', ''],
    ['', '', '', 'JM', String(jmTotal), '', '', '', '', '', '', ''],
    ['', '', '', 'Mahesh', String(maheshTotal), '', '', '', '', '', '', ''],
  ]);
}

function buildExpensesPdfHtml(params: {
  expenses: Expense[];
  filterLabel: string;
  total: number;
  jmTotal: number;
  maheshTotal: number;
  generatedOn: string;
}): string {
  const rows = toExpenseExportRows(params.expenses);
  const tableRows = rows.length
    ? rows.map((r) => `
        <tr>
          <td>${escapeHtml(formatDate(r.date))}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${escapeHtml(r.vehicle)}</td>
          <td>${escapeHtml(r.category)}</td>
          <td class="num">${escapeHtml(formatCurrency(Number(r.amount)))}</td>
          <td>${escapeHtml(r.description)}</td>
          <td>${escapeHtml(r.entity)}</td>
          <td>${escapeHtml(r.paidBy)}</td>
          <td>${escapeHtml(r.givenTo)}</td>
          <td>${escapeHtml(r.paidFrom)}</td>
        </tr>`).join('')
    : '<tr><td colspan="10" class="muted">No expenses</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Expenses-${escapeHtml(params.filterLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; font: 10px/1.35 Arial, sans-serif; color: #111; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { font-size: 10px; color: #444; margin-bottom: 10px; }
    .summary { display: flex; flex-wrap: wrap; gap: 16px 28px; margin-bottom: 14px; font-size: 11px; }
    .summary .total { font-size: 12px; }
    .summary strong { font-size: 14px; }
    .summary .total strong { font-size: 16px; color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #bbb; padding: 4px 5px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; font-size: 9px; text-transform: uppercase; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: bold; background: #f8f8f8; }
    tfoot .total-label { text-align: right; }
    .muted { text-align: center; color: #666; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>JM Transport — Expenses</h1>
  <p class="meta">${escapeHtml(params.filterLabel)} · Generated ${escapeHtml(formatDate(params.generatedOn))} · ${rows.length} row(s)</p>
  <div class="summary">
    <div class="total">Total <strong>${escapeHtml(formatCurrency(params.total))}</strong></div>
    <div>JM <strong>${escapeHtml(formatCurrency(params.jmTotal))}</strong></div>
    <div>Mahesh <strong>${escapeHtml(formatCurrency(params.maheshTotal))}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Type</th><th>Vehicle</th><th>Category</th>
        <th class="num">Amount</th><th>Description</th><th>Entity</th>
        <th>Paid by</th><th>Given to</th><th>Paid from</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="total-label">Total</td>
        <td class="num">${escapeHtml(formatCurrency(params.total))}</td>
        <td colspan="5"></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

export function printExpensesPdf(params: {
  expenses: Expense[];
  filterLabel: string;
  total: number;
  jmTotal: number;
  maheshTotal: number;
  generatedOn: string;
}): void {
  const html = buildExpensesPdfHtml(params);
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
