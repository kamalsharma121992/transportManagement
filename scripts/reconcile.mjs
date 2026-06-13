import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

const { data } = await s.from('expenses')
  .select('id, date, expense_type, category, amount, person, paid_by_person, description')
  .order('id');

const ve = data.filter(e => e.expense_type === 'vehicle');
const bm = data.filter(e => e.person === 'Bimal/Mohit/Mahesh');
const grid = data.filter(e => e.expense_type !== 'vehicle' && e.person !== 'Bimal/Mohit/Mahesh');

const veTotal = ve.reduce((s, e) => s + Number(e.amount), 0);
const bmTotal = bm.reduce((s, e) => s + Number(e.amount), 0);
const gridTotal = grid.reduce((s, e) => s + Number(e.amount), 0);
const total = veTotal + bmTotal + gridTotal;

console.log('=== DB Breakdown ===');
console.log(`Vehicle: ${ve.length} rows = ₹${veTotal}`);
console.log(`Daily (B/M/M): ${bm.length} rows = ₹${bmTotal}`);
console.log(`Grid (individuals): ${grid.length} rows = ₹${gridTotal}`);
console.log(`Total: ₹${total}`);
console.log(`Expected: ₹797082`);
console.log(`Diff: ₹${797082 - total}`);
console.log('');

// User-added entries (high IDs)
const userAdded = data.filter(e => e.id >= 480);
if (userAdded.length > 0) {
  console.log('=== User-added entries (id >= 480) ===');
  userAdded.forEach(r => console.log(`  id:${r.id} | ${r.date} | ${r.category} | ₹${r.amount} | ${r.description || ''}`));
  const uaTotal = userAdded.reduce((s, e) => s + Number(e.amount), 0);
  console.log(`User-added total: ₹${uaTotal}`);
  console.log(`Without user-added: ₹${total - uaTotal}`);
  console.log('');
}

console.log('=== Grid entries ===');
grid.forEach(r => console.log(`  ${r.date} | ${r.person || '-'} | ${r.category} | ₹${r.amount}`));

// What the Expense Grid CSV actually has (June only):
const gridExpected = [
  10000, 1500, 490, 500, 500, 1000, 1000, 1000, 500, 1000,  // Babu Khan
  110, 160, 3290, 600,  // Bimal
  1500, 500, 500, 1000, 1000, 1000, 500, 1000,  // Janu Khan
  500, 500, 6000, 500, 500, 2000, 1000,  // Laxman
  200,  // Mahesh
  349, 160,  // Mohit
  1150,  // Misc
  3060,  // Office
];
const gridExpectedTotal = gridExpected.reduce((s, v) => s + v, 0);
console.log('');
console.log(`Grid expected (from CSV): ₹${gridExpectedTotal} (${gridExpected.length} entries)`);
console.log(`Grid in DB: ₹${gridTotal} (${grid.length} entries)`);
console.log(`Grid diff: ₹${gridTotal - gridExpectedTotal}`);
