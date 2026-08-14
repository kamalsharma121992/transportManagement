import { formatCurrency, formatDate } from '@/lib/format';
import { computeIfLeavesTodayPay, type MonthlyPayrollRow } from '@/lib/driver-payroll';

const PAY_KIND_LABEL: Record<MonthlyPayrollRow['payLines'][number]['kind'], string> = {
  advance: 'Advance',
  allowance: 'Rozana bhatta',
  salary: 'Tankhwah',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slipFilename(driverName: string, month: string): string {
  const safe = driverName.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return `Salary-Slip-${safe}-${month}`;
}

export function printSalarySlip(params: {
  row: MonthlyPayrollRow;
  month: string;
  monthLabel: string;
  generatedOn: string;
}): void {
  const popup = window.open('', '_blank', 'width=900,height=1200');
  if (!popup) {
    throw new Error('Allow pop-ups to download the salary slip PDF');
  }

  const filename = slipFilename(params.row.driver.name, params.month);
  popup.document.write(buildSalarySlipHtml({ ...params, filename }));
  popup.document.close();
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close());
  setTimeout(() => popup.print(), 250);
}

function moneyCell(amount: number): string {
  return escapeHtml(formatCurrency(amount));
}

function buildSalarySlipHtml(params: {
  row: MonthlyPayrollRow;
  month: string;
  monthLabel: string;
  generatedOn: string;
  filename: string;
}): string {
  const { row, month, monthLabel, generatedOn } = params;
  const { driver } = row;
  const exitPay = computeIfLeavesTodayPay(row, month);
  const leaveDeduction = row.salaryLeaveDays > 0;
  const overpaid = exitPay.overpaid;
  const netPayable = exitPay.total;
  const gross = exitPay.salaryForExit + row.allowanceDue;

  const payBox =
    overpaid > 0
      ? {
          hindi: 'ZYADA MIL CHUKA',
          english: 'Extra already given — nothing more to pay',
          amount: moneyCell(overpaid),
          cls: 'pay-box extra',
        }
      : netPayable > 0.01
        ? {
            hindi: 'AAPKO AB MILENGE',
            english: 'This is the money you will get',
            amount: moneyCell(netPayable),
            cls: 'pay-box due',
          }
        : {
            hindi: 'SAB MIL CHUKA',
            english: 'All money already given — nothing left',
            amount: moneyCell(0),
            cls: 'pay-box settled',
          };

  const paymentRows = row.payLines.length
    ? row.payLines
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(formatDate(line.date))}</td>
              <td>${escapeHtml(PAY_KIND_LABEL[line.kind])}</td>
              <td>${escapeHtml(line.description || line.note)}</td>
              <td class="num">${moneyCell(line.amount)}</td>
            </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="muted">Is cycle mein koi payment nahi hui.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.filename)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font: 14px/1.45 "Segoe UI", Arial, sans-serif;
    }
    .slip { max-width: 720px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .brand { font-size: 20px; font-weight: 700; }
    .doc-title { font-size: 15px; font-weight: 700; text-align: right; }
    .meta { font-size: 12px; color: #444; margin-top: 2px; }
    .name {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 4px;
    }
    .pay-box {
      border: 3px solid #111;
      border-radius: 8px;
      padding: 16px 18px;
      text-align: center;
      margin: 14px 0 18px;
    }
    .pay-box.due { background: #fff3b0; border-color: #c9a227; }
    .pay-box.settled { background: #d8f3dc; border-color: #2d6a4f; }
    .pay-box.extra { background: #d8f3dc; border-color: #2d6a4f; }
    .pay-label {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .pay-sub { font-size: 13px; margin-top: 2px; }
    .pay-amount {
      font-size: 42px;
      font-weight: 800;
      margin-top: 6px;
      line-height: 1.1;
    }
    h2 {
      font-size: 13px;
      margin: 16px 0 6px;
      color: #222;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid #bbb;
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f3f3f3; font-size: 12px; }
    td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .muted { color: #666; text-align: center; }
    .minus { color: #9b1c1c; }
    .plus { color: #1b4332; }
    .net td {
      background: #fff3b0;
      font-size: 16px;
      font-weight: 800;
    }
    .sign {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      gap: 40px;
    }
    .sign div {
      width: 45%;
      border-top: 1px solid #111;
      padding-top: 6px;
      font-size: 12px;
    }
    .footnote { margin-top: 22px; font-size: 11px; color: #666; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <div>
        <div class="brand">JM Transport</div>
        <div class="meta">Salary slip / Tankhwah parchi</div>
      </div>
      <div>
        <div class="doc-title">${escapeHtml(monthLabel)}</div>
        <div class="meta">${escapeHtml(formatDate(row.periodStart))} – ${escapeHtml(formatDate(row.periodEnd))}</div>
      </div>
    </div>

    <p class="name">${escapeHtml(driver.name)}</p>
    <div class="meta">${escapeHtml(driver.phone || '')}</div>

    <div class="${payBox.cls}">
      <div class="pay-label">${payBox.hindi}</div>
      <div class="pay-sub">${payBox.english}</div>
      <div class="pay-amount">${payBox.amount}</div>
    </div>

    <h2>Hisab — kaise nikla</h2>
    <table>
      <tr><th>Kya</th><th class="num">Rupaye</th></tr>
      <tr>
        <td>Tankhwah (${exitPay.employedDays}/${exitPay.periodDays} din)${leaveDeduction ? ` — chhutti kat ${row.salaryLeaveDays} din` : ''}</td>
        <td class="num plus">${moneyCell(exitPay.salaryForExit)}</td>
      </tr>
      <tr>
        <td>Rozana bhatta (${row.workingDays} din × ${moneyCell(row.dailyRate)})</td>
        <td class="num plus">${moneyCell(row.allowanceDue)}</td>
      </tr>
      ${
        row.allowancePaid > 0
          ? `<tr><td>Bhatta pehle mil chuka</td><td class="num minus">− ${moneyCell(row.allowancePaid)}</td></tr>`
          : ''
      }
      ${
        row.salaryPaid > 0
          ? `<tr><td>Tankhwah pehle mil chuki</td><td class="num minus">− ${moneyCell(row.salaryPaid)}</td></tr>`
          : ''
      }
      ${
        row.advancePaid > 0
          ? `<tr><td>Advance pehle le liya</td><td class="num minus">− ${moneyCell(row.advancePaid)}</td></tr>`
          : ''
      }
      ${
        overpaid > 0
          ? `<tr class="net"><td>Zyada mil chuka</td><td class="num">${moneyCell(overpaid)}</td></tr>`
          : `<tr class="net"><td>Ab milenge</td><td class="num">${moneyCell(netPayable)}</td></tr>`
      }
    </table>

    <h2>Kaam ke din</h2>
    <table>
      <tr>
        <th>Kaam</th>
        <th>Chhutti</th>
        <th>Tankhwah se kati chhutti</th>
      </tr>
      <tr>
        <td>${row.workingDays} din</td>
        <td>${row.leaveDays} din</td>
        <td>${row.salaryLeaveDays} din</td>
      </tr>
    </table>

    <h2>Pehle mili hui rashi (date ke saath)</h2>
    <table>
      <tr>
        <th>Tarikh</th>
        <th>Kis baat ka</th>
        <th>Detail</th>
        <th class="num">Rupaye</th>
      </tr>
      ${paymentRows}
    </table>

    <div class="sign">
      <div>Driver ke sign — maine rashi dekh li</div>
      <div>JM Transport</div>
    </div>
    <p class="footnote">${escapeHtml(monthLabel)} · ${escapeHtml(formatDate(generatedOn))} · Kul kamai ${moneyCell(gross)}</p>
  </div>
</body>
</html>`;
}
