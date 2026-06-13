import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

const { data: all } = await s.from('expenses').select('expense_type, amount');

const byType = {};
all.forEach(r => {
  byType[r.expense_type] = (byType[r.expense_type] || 0) + Number(r.amount);
});

const total = all.reduce((s, r) => s + Number(r.amount), 0);

console.log('Expense totals by type:');
for (const [type, sum] of Object.entries(byType)) {
  console.log(`  ${type}: ₹${sum}`);
}
console.log(`\nGrand total: ₹${total}`);
console.log(`Expected:    ₹797082`);
console.log(`Difference:  ₹${797082 - total}`);
console.log(`\nTotal rows: ${all.length}`);

// Check if Driver Salary is somewhere
const { data: ds } = await s.from('expenses').select('*').ilike('category', '%salary%');
console.log('\nSalary-related expenses:', ds.length);
if (ds.length) ds.forEach(r => console.log(r));

// The spreadsheet dashboard mentions Driver Salary ₹18,000
// Check if this comes from the Expense Grid or somewhere else
console.log('\nMissing ₹' + (797082 - total) + ' could be:');
console.log('  - Driver Salary: ₹18,000 (shown on dashboard but not in any expense sheet)');
console.log('  - Remaining: ₹' + (797082 - total - 18000));
