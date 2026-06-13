import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

// Add Pratap Ram to partners (he's already a driver but needs to be in partners for person field)
await s.from('partners').upsert({ name: 'Pratap Ram' }, { onConflict: 'name' });
console.log('✓ Ensured Pratap Ram in partners');

// Fix Office Expense: we have ₹660 but should have ₹660 + ₹10,000 + ₹2,400 (06/06 total is 3060, not 660)
// Wait, let me recalculate: Office Expense column shows ₹10,000 on 24/05 and ₹3,060 on 06/06
// We have ₹660 on 06/06. So we need to:
// 1. Update existing ₹660 to proper amount or add the missing entries
// Actually our DB has 2 entries: ₹1150 (Misc) and ₹660 (Office) on 06/06
// The grid shows Misc=1150 and Office=3060 on 06/06. So we need to update 660→3060
// And add Office ₹10,000 on 24/05

// First delete the wrong ₹660 office entry
const { data: wrongOffice } = await s.from('expenses')
  .select('id')
  .eq('amount', 660)
  .eq('description', 'Office expense')
  .is('person', null);
if (wrongOffice.length > 0) {
  await s.from('expenses').delete().eq('id', wrongOffice[0].id);
  console.log('✓ Deleted wrong ₹660 office entry');
}

const missing = [
  // Pratap Ram - driver daily allowances/advances from Expense Grid May data
  { date: '2026-05-23', expense_type: 'operational', person: 'Pratap Ram', category: 'Daily Allowance', amount: 1000, paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-25', expense_type: 'operational', person: 'Pratap Ram', category: 'Daily Allowance', amount: 850, paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-26', expense_type: 'operational', person: 'Pratap Ram', category: 'Advance', amount: 5140, description: 'Advance payment', paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-27', expense_type: 'operational', person: 'Pratap Ram', category: 'Daily Allowance', amount: 2000, paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-28', expense_type: 'operational', person: 'Pratap Ram', category: 'Daily Allowance', amount: 125, paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-29', expense_type: 'operational', person: 'Pratap Ram', category: 'Daily Allowance', amount: 330, paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-05-31', expense_type: 'operational', person: 'Pratap Ram', category: 'Advance', amount: 5000, description: 'Advance payment', paid_by: 'JM transport', status: 'Paid' },

  // Bimal - May personal expense
  { date: '2026-05-24', expense_type: 'personal', person: 'Bimal', category: 'Personal Care', amount: 500, paid_by: 'JM transport', status: 'Paid' },

  // Mahesh - May entry
  { date: '2026-05-25', expense_type: 'operational', person: 'Mahesh', category: 'Daily Allowance', amount: 360, paid_by: 'JM transport', status: 'Paid' },

  // Office Expense - corrected values
  { date: '2026-05-24', expense_type: 'operational', category: 'Supplies', amount: 10000, description: 'Office expense', paid_by: 'JM transport', status: 'Paid' },
  { date: '2026-06-06', expense_type: 'operational', category: 'Supplies', amount: 3060, description: 'Office expense', paid_by: 'JM transport', status: 'Paid' },
];

const { error } = await s.from('expenses').insert(missing);
if (error) {
  console.error('ERROR:', error.message);
} else {
  console.log(`✓ Added ${missing.length} missing entries`);
}

// Verify final totals
const { data: all } = await s.from('expenses').select('amount');
const total = all.reduce((sum, r) => sum + Number(r.amount), 0);
const { count } = await s.from('expenses').select('*', { count: 'exact', head: true });

console.log(`\nFinal total: ₹${total} (expected: ₹797082)`);
console.log(`Difference: ₹${797082 - total}`);
console.log(`Total rows: ${count}`);
