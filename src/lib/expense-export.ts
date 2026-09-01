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
  downloadCsv(`expenses-${suffix}.csv`, [
    [...CSV_HEADERS],
    ...rows.map((r) => [
      r.date, r.type, r.vehicle, r.category, r.amount, r.description,
      r.entity, r.paidBy, r.givenTo, r.paidFrom, r.status, r.billReceipt,
    ]),
  ]);
}

export function printExpensesPdf(params: {
  expenses: Expense[];
  filterLabel: string;
  total: number;
  jmTotal: number;
  maheshTotal: number;
  generatedOn: string;
}): void {
  const popup = window.open('', '_blank', 'width=1200,height=900');
  if (!popup) {
    throw new Error('Allow pop-ups to download the PDF');
  }

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

  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Expenses-${escapeHtml(params.filterLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; font: 10px/1.35 Arial, sans-serif; color: #111; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { font-size: 10px; color: #444; margin-bottom: 10px; }
    .summary { display: flex; gap: 24px; margin-bottom: 12px; font-size: 11px; }
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
  <h1>JM Transport — Expenses</h1>
  <p class="meta">${escapeHtml(params.filterLabel)} · Generated ${escapeHtml(formatDate(params.generatedOn))} · ${rows.length} row(s)</p>
  <div class="summary">
    <div>Total <strong>${escapeHtml(formatCurrency(params.total))}</strong></div>
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
  </table>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close());
  setTimeout(() => popup.print(), 250);
}
