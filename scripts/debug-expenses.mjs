import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

const { data: bm } = await s.from('expenses')
  .select('id,date,category,amount,description,paid_by')
  .eq('person', 'Bimal/Mohit/Mahesh')
  .order('date')
  .order('amount');

// Sheet daily expense totals per date (from the spreadsheet)
const sheetTotals = {
  '2026-05-19': 1900, '2026-05-20': 300, '2026-05-21': 2245,
  '2026-05-22': 1090, '2026-05-23': 28570, '2026-05-24': 742,
  '2026-05-25': 2024, '2026-05-26': 486, '2026-05-27': 665,
  '2026-05-28': 870, '2026-05-29': 250, '2026-05-30': 240,
  '2026-05-31': 915, '2026-06-01': 300, '2026-06-02': 456,
  '2026-06-03': 1165, '2026-06-04': 500, '2026-06-05': 395,
  '2026-06-06': 970, '2026-06-07': 5203, '2026-06-09': 270,
  '2026-06-12': 474, '2026-06-13': 130,
};

const byDate = {};
bm.forEach(r => {
  if (!byDate[r.date]) byDate[r.date] = [];
  byDate[r.date].push(r);
});

let dbTotal = 0;
let sheetTotal = 0;

console.log('Date-by-date comparison (Bimal/Mohit/Mahesh):');
const allDates = [...new Set([...Object.keys(byDate), ...Object.keys(sheetTotals)])].sort();
for (const d of allDates) {
  const dbRows = byDate[d] || [];
  const dbSum = dbRows.reduce((s, r) => s + Number(r.amount), 0);
  const sheetSum = sheetTotals[d] || 0;
  dbTotal += dbSum;
  sheetTotal += sheetSum;
  const match = dbSum === sheetSum ? '✓' : '✗';
  if (dbSum !== sheetSum) {
    console.log(`  ${match} ${d}: DB=₹${dbSum} Sheet=₹${sheetSum} (diff: ${dbSum - sheetSum})`);
    dbRows.forEach(r => console.log(`      ₹${r.amount} | ${r.category} | ${r.description} | ${r.paid_by}`));
  }
}
console.log(`\nDB total: ₹${dbTotal} | Sheet total: ₹${sheetTotal} | Diff: ${dbTotal - sheetTotal}`);
console.log(`DB rows: ${bm.length}`);
