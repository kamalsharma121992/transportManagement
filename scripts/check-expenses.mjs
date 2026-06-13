import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

const { data } = await s.from('expenses')
  .select('id, date, expense_type, person, category, amount, description')
  .neq('expense_type', 'vehicle')
  .order('date')
  .order('person');

console.log('=== ALL non-vehicle expenses in DB: ' + data.length + ' rows ===\n');

const byPerson = {};
data.forEach(r => {
  const p = r.person || 'NULL';
  if (!byPerson[p]) byPerson[p] = [];
  byPerson[p].push(r);
});

for (const [person, rows] of Object.entries(byPerson)) {
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`${person}: ${rows.length} rows, total: ₹${total}`);
  rows.forEach(r => console.log(`  ${r.date} | ${r.category} | ₹${r.amount} | ${r.description || ''}`));
  console.log('');
}
